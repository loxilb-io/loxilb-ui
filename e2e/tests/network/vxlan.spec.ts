//---------------------------------------------------------
// VXLAN page spec (docs/E2E_CRUD_TEST_PLAN.md §5).
// POST /config/tunnel/vxlan (create), DELETE /config/tunnel/vxlan/{id}. Peers
// live in a sub-panel: POST .../{id}/peer, DELETE .../{id}/peer/{ip}. Uses
// reserved id 3999 on eth0 and a doc-range peer (203.0.113.60) — an inert
// tunnel with an unreachable peer. afterEach sweeps test ids.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepVxlans} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {reloadUntilGone, reloadUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const VX_PATH = '/config/tunnel/vxlan';
const VXID = 3999;
const PEER = '203.0.113.60';

async function captureDeletes(page: Page, needle: string, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(needle)) urls.push(new URL(r.url()));
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return urls;
}

let instName: string;

test.describe('VXLAN page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepVxlans();
	});

	test.afterEach(async () => {
		await sweepVxlans();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/vxlan?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: epIntf + vxlanID POST clean, then D-single', async ({page}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('New VxLAN')).toBeVisible();
		await field(page, 'Endpoint Interface').fill('eth0');
		await field(page, 'VXLAN ID').fill(String(VXID));

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(VX_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({epIntf: 'eth0', vxlanID: VXID});
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted vxlan create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await reloadUntilRow(page, String(VXID));

		const deletes = await captureDeletes(page, `${VX_PATH}/${VXID}`, async () => {
			await selectRowByText(page, String(VXID));
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain(`/vxlan/${VXID}`);
		await reloadUntilGone(page, String(VXID));
	});

	test('peer add + delete via the sub-panel', async ({page}) => {
		expect((await gw('POST', VX_PATH, {epIntf: 'eth0', vxlanID: VXID})).status).toBeLessThan(300);

		await reloadUntilRow(page, String(VXID));
		await selectRowByText(page, String(VXID)); // opens the peer sub-panel

		// Add peer — the panel's text "Add" button (toolbar Add is icon-only).
		await page.getByRole('button', {name: 'Add', exact: true}).click();
		await expect(dialog(page).getByText('New VxLAN Peer')).toBeVisible();
		await field(page, 'Peer IP').fill(PEER);
		const [addReq] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(`${VX_PATH}/${VXID}/peer`)),
			dialogButton(page, 'Add').click(),
		]);
		expect(addReq.postDataJSON()).toMatchObject({peerIP: PEER});
		await expect(dialog(page).getByText('Created successfully.')).toBeVisible();
		await dialogButton(page, 'OK').click();

		// The peer chip appears after the panel refetches.
		const chip = page.locator('.MuiChip-root').filter({hasText: PEER});
		await expect(chip).toBeVisible({timeout: 15_000});

		// Delete the peer via the chip's delete icon.
		const deletes = await captureDeletes(page, `${VXID}/peer/`, async () => {
			await chip.locator('.MuiChip-deleteIcon').click();
			await expect(dialog(page).getByText('Deleted successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain(`/vxlan/${VXID}/peer/${PEER}`);
	});

	test('V-peer-ip: malformed peer IP blocks submit in the peer sub-panel', async ({page}) => {
		expect((await gw('POST', VX_PATH, {epIntf: 'eth0', vxlanID: VXID})).status).toBeLessThan(300);

		await reloadUntilRow(page, String(VXID));
		await selectRowByText(page, String(VXID)); // opens the peer sub-panel

		await page.getByRole('button', {name: 'Add', exact: true}).click();
		await expect(dialog(page).getByText('New VxLAN Peer')).toBeVisible();
		const addBtn = dialogButton(page, 'Add');

		expect(await isEventuallyDisabled(addBtn), 'empty peer IP must block').toBe(true);

		// A malformed peer IP would be programmed as a zero-IP FDB entry — the
		// form must block it, not the gateway.
		await field(page, 'Peer IP').fill('999.1.2.3');
		expect(await isEventuallyDisabled(addBtn), 'malformed peer IP must block').toBe(true);
		await expect(dialog(page).getByText(/valid IP address/)).toBeVisible();

		await field(page, 'Peer IP').fill(PEER);
		await expect(addBtn).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
	});

	test('V-id: empty/zero/out-of-range vxlanID and empty epIntf all block submit', async ({page}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('New VxLAN')).toBeVisible();
		const addBtn = dialogButton(page, 'Add');

		await field(page, 'Endpoint Interface').fill('eth0');
		expect(await isEventuallyDisabled(addBtn), 'empty vxlanID must block').toBe(true);

		await field(page, 'VXLAN ID').fill(String(VXID));
		await expect(addBtn).toBeEnabled();

		await field(page, 'VXLAN ID').fill('0');
		expect(await isEventuallyDisabled(addBtn), 'vxlanID 0 must block').toBe(true);

		// VNI is a 24-bit field — one past the ceiling must block with a visible
		// reason; the ceiling itself is valid.
		await field(page, 'VXLAN ID').fill('16777216');
		expect(await isEventuallyDisabled(addBtn), 'vni 2^24 must block').toBe(true);
		await expect(dialog(page).getByText(/between 1 and 16777215/)).toBeVisible();
		await field(page, 'VXLAN ID').fill('16777215');
		await expect(addBtn).toBeEnabled();

		// The endpoint interface is required — the gateway just fails the create
		// without one.
		await field(page, 'Endpoint Interface').fill('');
		expect(await isEventuallyDisabled(addBtn), 'empty epIntf must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});
});
