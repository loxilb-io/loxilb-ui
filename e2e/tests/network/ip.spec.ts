//---------------------------------------------------------
// IPv4 address page spec (docs/E2E_CRUD_TEST_PLAN.md §5).
// The page has NO Add button — Edit (Mode) IS the create path: it re-uses
// POST /config/ipv4address with the row's (locked) device + a new IP, which
// adds a secondary address. Delete: /config/ipv4address/{ip}/{mask}/dev/{dev}.
//
// Safety: a /32 documentation-range secondary on the target device is non-disruptive
// and inert; the afterEach sweep removes only doc-range addresses.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gwJson, isDocAddr, sweepIpAddresses} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const V4_PATH = '/config/ipv4address';
// The edit-target row (a stable primary address) is DERIVED from the live
// testbed in beforeAll — hardcoding docker0/172.17.0.1 broke the suite the
// moment it ran against a testbed without a docker bridge (cloud-testbed: eth0 only).
let BASE_DEV = '';
let BASE_IP = '';
const NEW_IP = '203.0.113.30/32';

async function openEditFor(page: Page, rowText: string): Promise<void> {
	await selectRowByText(page, rowText);
	await toolbarButton(page, 'Mode').click();
	await expect(dialog(page).getByText('New IP Address')).toBeVisible();
	await expect(field(page, 'IP Address')).toBeVisible();
}

async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(V4_PATH)) urls.push(new URL(r.url()));
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

test.describe('IPv4 address page (edit-is-create)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepIpAddresses('ipv4');
		// Pick the edit-target row from the live address table: the first
		// non-loopback device with a real (non-doc-range) primary address.
		const data = await gwJson<{ipAttr?: Array<{dev: string; ipAddress?: string[]}>}>(`${V4_PATH}/all`);
		for (const attr of data.ipAttr ?? []) {
			if (attr.dev === 'lo') continue;
			const primary = (attr.ipAddress ?? []).find(cidr => !isDocAddr(cidr));
			if (primary) {
				BASE_DEV = attr.dev;
				BASE_IP = primary.split('/')[0];
				break;
			}
		}
		expect(BASE_DEV, 'testbed must expose a non-lo device with an IPv4 address').toBeTruthy();
	});

	test.afterEach(async () => {
		await sweepIpAddresses('ipv4');
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/ip?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
		await refreshUntilRow(page, BASE_IP);
	});

	test('E-update-create: editing a row POSTs {dev, new ip} with dev locked, then D', async ({page}) => {
		await openEditFor(page, BASE_IP);
		// Device is the identity in edit mode → disabled.
		await expect(field(page, 'Device Name')).toBeDisabled();
		await field(page, 'IP Address').fill(NEW_IP);

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(V4_PATH)),
			dialogButton(page, 'Update').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({dev: BASE_DEV, ipAddress: NEW_IP});
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted ip create').toBeLessThan(300);
		await expect(dialog(page).getByText('IP address updated successfully.')).toBeVisible();
		await dialogButton(page, 'OK').click();

		await refreshUntilRow(page, NEW_IP);

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, NEW_IP);
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain(`/ipv4address/203.0.113.30/32/dev/${BASE_DEV}`);
		await refreshUntilGone(page, NEW_IP);
	});

	test('V-cidr: a bare IP (no mask) and garbage both block Update', async ({page}) => {
		await openEditFor(page, BASE_IP);
		const updateBtn = dialogButton(page, 'Update');

		await field(page, 'IP Address').fill(NEW_IP);
		await expect(updateBtn).toBeEnabled();

		// Missing mask → not a valid CIDR → blocked.
		await field(page, 'IP Address').fill('203.0.113.30');
		expect(await isEventuallyDisabled(updateBtn), 'IP without mask must block').toBe(true);

		// Garbage → blocked.
		await field(page, 'IP Address').fill('nonsense');
		expect(await isEventuallyDisabled(updateBtn), 'garbage IP must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});
});
