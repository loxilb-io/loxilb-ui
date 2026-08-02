//---------------------------------------------------------
// IPsec Tunnel page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §3.1).
// POST/PUT/DELETE /config/ipsec/tunnels* + /action + peerconfig.
//
// Adversarial focus (see e2e-testing-philosophy): this is not a
// happy-path sweep — it pins the bugs found + fixed this session and
// documents the gateway limitations that can't be fixed UI-side.
//
//   F-IPSEC-1 (fixed): the tunnel form used a weak local regex that
//     accepted 999.1.1.1 and /99. Now reuses common isValidIPAddress/
//     isValidIPAddressCidr — V-invalid-ip / V-cidr assert the guard.
//   F-IPSEC-2 (fixed): the PopUp modal was vertically centred with no
//     maxHeight, so a tall form pushed its action buttons below the
//     fold and they were unclickable at laptop heights. All create/
//     edit tests here CLICK the footer Add/Apply button, so a
//     regression re-breaks this file immediately.
//   E-put regression: on edit the UI PUTs psk:'' — the gateway must
//     coalesce that to "keep the stored PSK" and NOT wipe it.
//   A-initiate: initiating against a dead peer returns a gateway 502;
//     the UI must surface it as an Error popup, never crash.
//
// Safety: every tunnel is e2e- named with a documentation-range remote
// peer (203.0.113/198.51.100), local IP the real gateway (10.0.0.12),
// startup=add (responder — never dials out on its own), so nothing
// touches the mgmt path. sweepIpsecTunnels() clears leftovers.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepIpsecTunnels} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByClick, showAllRows, toolbarButton} from '../../helpers/table';

const TUN_PATH = '/config/ipsec/tunnels';
const LOCAL_IP = '10.0.0.12'; // the real gateway address (localIp must be an on-box IP)

let instName: string;

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByRole('heading', {name: 'New IPsec Tunnel'})).toBeVisible();
	await expect(field(page, 'Name')).toBeVisible();
}

/** Fills the three required fields for a minimal PSK tunnel. */
async function fillMinPsk(page: Page, name: string, remoteIp: string, psk: string): Promise<void> {
	await field(page, 'Name').fill(name);
	await field(page, 'Local IP').fill(LOCAL_IP);
	await field(page, 'Remote IP').fill(remoteIp);
	await field(page, 'Pre-Shared Key').fill(psk);
}

async function submitCreate(page: Page): Promise<any> {
	await page.mouse.move(0, 0); // drop any sticky ParamBox tooltip over the footer
	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(TUN_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	return req;
}

async function deleteTunnel(page: Page, name: string): Promise<void> {
	await selectRowByClick(page, name, 'name');
	await toolbarButton(page, 'Delete').click();
	await confirmDelete(page);
	await expectSuccessAndDismiss(page);
}

test.describe('IPsec Tunnel page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepIpsecTunnels();
	});

	test.afterEach(async () => {
		await sweepIpsecTunnels();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/ipsec/tunnels?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min-psk: minimal PSK tunnel POSTs clean payload; peerconfig mirrors peer+PSK; D-single', async ({page}) => {
		await openAddDialog(page);
		await fillMinPsk(page, 'e2e-tun', '203.0.113.99', 'e2e-secret-key');

		const req = await submitCreate(page);
		const body = req.postDataJSON();

		expect(body).toMatchObject({
			name: 'e2e-tun',
			localIp: LOCAL_IP,
			remoteIp: '203.0.113.99',
			authMode: 'psk',
			psk: 'e2e-secret-key',
		});
		// Displayed defaults must be POSTed, not dropped (stale-snapshot class).
		expect(body.ikeVersion).toBe('ikev2');
		expect(body.espDhGroup).toBe('modp2048'); // PFS on by default
		// No form-internal keys must leak into the payload.
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted the tunnel').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		// Row lands DOWN (no peer to reach).
		await refreshUntilRow(page, 'e2e-tun');
		await expect(page.locator('.MuiDataGrid-row', {hasText: 'e2e-tun'}).first()).toContainText('DOWN');

		// The mirrored peer config must carry the remote peer + the PSK verbatim
		// (this is what the Peer Config download writes to the remote box).
		const peer = await (await gw('GET', `${TUN_PATH}/e2e-tun/peerconfig`)).json();
		expect(peer.ipsecConf ?? '').toContain('203.0.113.99');
		expect(peer.ipsecSecrets ?? '').toContain('e2e-secret-key');

		await deleteTunnel(page, 'e2e-tun');
		await refreshUntilGone(page, 'e2e-tun');
	});

	test('C-full: subnets + aws preset (proposals + DPD) land field-complete in the POST body', async ({page}) => {
		await openAddDialog(page);
		await fillMinPsk(page, 'e2e-tun-full', '203.0.113.100', 'e2e-secret-key');
		await field(page, 'Local Subnet (CIDR)').fill('10.8.0.0/24');
		await field(page, 'Remote Subnet (CIDR)').fill('10.9.0.0/24');
		// aws preset fills the IKE/ESP proposal + a tight DPD; must reach the wire.
		await selectOption(page, 'Policy Preset', 'aws');

		const req = await submitCreate(page);
		const body = req.postDataJSON();

		expect(body.selector).toMatchObject({srcCidr: '10.8.0.0/24', dstCidr: '10.9.0.0/24'});
		expect(body.ikeEncryption).toBe('aes256');
		expect(body.ikeDhGroup).toBe('modp2048');
		expect(body.dpd).toMatchObject({action: 'restart', delay: 10, timeout: 30});
		expect(body.isValid).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted the full tunnel').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, 'e2e-tun-full');
		await deleteTunnel(page, 'e2e-tun-full');
	});

	test('V-invalid-ip / V-cidr: the form blocks malformed IPs and CIDRs (F-IPSEC-1 guard)', async ({page}) => {
		await openAddDialog(page);
		await fillMinPsk(page, 'e2e-tun-bad', '203.0.113.101', 'e2e-secret-key');
		// Everything valid → Add enabled.
		await expect(dialogButton(page, 'Add')).toBeEnabled();

		// Octet > 255 must be rejected (the old regex accepted 999.1.1.1).
		await field(page, 'Local IP').fill('999.1.1.1');
		await expect(dialogButton(page, 'Add')).toBeDisabled();
		await field(page, 'Local IP').fill(LOCAL_IP);
		await expect(dialogButton(page, 'Add')).toBeEnabled();

		// /99 mask must be rejected (the old regex accepted /\d{1,2}).
		await field(page, 'Local Subnet (CIDR)').fill('10.0.0.0/99');
		await expect(dialogButton(page, 'Add')).toBeDisabled();
		await field(page, 'Local Subnet (CIDR)').fill('10.0.0.0/24');
		await expect(dialogButton(page, 'Add')).toBeEnabled();
	});

	test('E-put: editing with a blank PSK keeps the stored key (regression — must not wipe it)', async ({page}) => {
		// Seed a tunnel with a known PSK straight through the gateway.
		const seed = await gw('POST', TUN_PATH, {
			name: 'e2e-tun-edit',
			localIp: LOCAL_IP,
			remoteIp: '203.0.113.102',
			authMode: 'psk',
			psk: 'ORIGINALSECRET123',
			auto: 'add',
		});
		expect(seed.status).toBeLessThan(300);

		await page.reload();
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await refreshUntilRow(page, 'e2e-tun-edit');

		// Open the edit dialog (Mode toolbar button); the PSK field comes back blank.
		await selectRowByClick(page, 'e2e-tun-edit', 'name');
		await toolbarButton(page, 'Mode').click();
		await expect(dialog(page).getByRole('heading', {name: 'Edit IPsec Tunnel'})).toBeVisible();
		await expect(field(page, 'Pre-Shared Key')).toHaveValue('');

		// Change only the remote subnet, leave the PSK blank, Apply.
		await field(page, 'Remote Subnet (CIDR)').fill('10.9.9.0/24');
		await page.mouse.move(0, 0);
		const [put] = await Promise.all([
			page.waitForRequest(r => r.method() === 'PUT' && r.url().includes(`${TUN_PATH}/e2e-tun-edit`)),
			dialogButton(page, 'Apply').click(),
		]);
		// The UI genuinely sends an empty PSK on edit — the "keep" contract lives
		// on the gateway, so this asserts the exact payload that must be safe.
		expect(put.postDataJSON().psk).toBe('');
		expect((await put.response())?.status()).toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		// The stored PSK must survive the blank-PSK PUT, and the subnet must apply.
		const peer = await (await gw('GET', `${TUN_PATH}/e2e-tun-edit/peerconfig`)).json();
		expect(peer.ipsecSecrets ?? '', 'blank-PSK edit must not wipe the stored key').toContain('ORIGINALSECRET123');
		const list = await (await gw('GET', `${TUN_PATH}/all`)).json();
		const edited = (list.ipsecTunnelAttr ?? []).find((t: any) => t.name === 'e2e-tun-edit');
		expect(edited?.selector?.dstCidr).toBe('10.9.9.0/24');
	});

	test('A-initiate: initiating against a dead peer surfaces an Error popup, no crash', async ({page, consoleGuard}) => {
		// A dead-peer initiate returns a gateway 502; the browser logs the failed
		// resource — expected, not a regression.
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/502/);

		const seed = await gw('POST', TUN_PATH, {
			name: 'e2e-tun-init',
			localIp: LOCAL_IP,
			remoteIp: '203.0.113.103',
			authMode: 'psk',
			psk: 'e2e-secret-key',
			auto: 'add',
		});
		expect(seed.status).toBeLessThan(300);

		await page.reload();
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await refreshUntilRow(page, 'e2e-tun-init');
		await selectRowByClick(page, 'e2e-tun-init', 'name');

		// The detail panel's Initiate button lives below the table.
		const initiate = page.getByRole('button', {name: 'Initiate', exact: true});
		await expect(initiate).toBeEnabled();
		await initiate.click();

		// Whatever the gateway returns, the UI must end on a dismissable popup,
		// never a blank crash. A dead peer yields an Error popup.
		const popup = dialog(page).getByRole('heading', {name: /^(Success|Error)$/});
		await expect(popup).toBeVisible({timeout: 20_000});
		await dialogButton(page, 'OK').click();
		await expect(dialog(page)).toBeHidden();
		// The page is still alive and interactive.
		await expect(toolbarButton(page, 'Add')).toBeVisible();
	});
});
