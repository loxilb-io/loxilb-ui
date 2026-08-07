//---------------------------------------------------------
// VLAN page spec.
// POST /config/vlan (create), DELETE /config/vlan/{vid}. Members live in a
// sub-panel: POST /config/vlan/{vid}/member, DELETE .../member/{dev}/tagged/{t}.
// Uses reserved vid 3999 (real testbed VLANs are 380x) and a tagged member on
// eth0 (non-disruptive to untagged mgmt traffic). afterEach sweeps test vids.
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson, sweepVlans} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const VLAN_PATH = '/config/vlan';
const VID = 3990; // clean reserved test vid (3999 wedged during bring-up)
const MEMBER_VID = 3991;

// The member sub-panel renders a second DataTable — target its (2nd) toolbar
// and grid explicitly since #table-bar / .MuiDataGrid-root ids repeat.
function memberGrid(page: Page): Locator {
	return page.locator('.MuiDataGrid-root').nth(1);
}
function memberToolbar(page: Page, icon: 'Add' | 'Delete'): Locator {
	return page.locator('#table-bar').nth(1).locator(`button:has([data-testid="${icon}Icon"])`).first();
}

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

test.describe('VLAN page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepVlans();
	});

	test.afterEach(async () => {
		await sweepVlans();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/vlan?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: vid POST clean, then D-single', async ({page}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('New VLAN')).toBeVisible();
		await field(page, 'VLAN ID').fill(String(VID));

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(VLAN_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body.vid).toBe(VID);
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted vlan create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, String(VID));

		const deletes = await captureDeletes(page, `${VLAN_PATH}/${VID}`, async () => {
			await selectRowByText(page, String(VID));
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain(`/vlan/${VID}`);
		await refreshUntilGone(page, String(VID));
	});

	test('V-member-delete: a tagged member deletes via the base device name (not eth0.<vid>)', async ({page}) => {
		const memberDev = `eth0.${MEMBER_VID}`;
		// Seed vlan + tagged member via API; the gateway lists the member as
		// "eth0.<vid>", but its delete endpoint only accepts the base dev "eth0".
		expect((await gw('POST', VLAN_PATH, {vid: MEMBER_VID})).status).toBeLessThan(300);
		expect((await gw('POST', `${VLAN_PATH}/${MEMBER_VID}/member`, {dev: 'eth0', tagged: true})).status).toBeLessThan(300);

		await refreshUntilRow(page, String(MEMBER_VID));
		await selectRowByText(page, String(MEMBER_VID)); // opens the member sub-panel
		await expect(memberGrid(page).locator('.MuiDataGrid-row').filter({hasText: memberDev})).toHaveCount(1);

		const deletes = await captureDeletes(page, '/member/', async () => {
			await memberGrid(page).locator('.MuiDataGrid-row').filter({hasText: memberDev}).getByRole('checkbox').check();
			await memberToolbar(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes).toHaveLength(1);
		// The fix: the DELETE uses the base dev, not the "eth0.<vid>" the grid shows.
		expect(deletes[0].pathname).toContain(`/vlan/${MEMBER_VID}/member/eth0/tagged/true`);
		expect(deletes[0].pathname, 'must not send the suffixed dev').not.toContain(memberDev);

		// The member must actually be gone at the gateway (base-dev delete landed).
		// Assert against the API, not the grid — the sub-panel's refetch is racy.
		await expect
			.poll(async () => {
				const data = await gwJson<{vlanAttr?: {vid: number; member?: unknown[]}[]}>('/config/vlan/all');
				const v = (data.vlanAttr ?? []).find(x => x.vid === MEMBER_VID);
				return (v?.member ?? []).length;
			}, {timeout: 10_000})
			.toBe(0);
	});

	test('V-vid: empty, zero and out-of-range vid all block submit', async ({page}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('New VLAN')).toBeVisible();
		const addBtn = dialogButton(page, 'Add');

		// Empty vid (initial) → blocked.
		expect(await isEventuallyDisabled(addBtn), 'empty vid must block').toBe(true);

		await field(page, 'VLAN ID').fill(String(VID));
		await expect(addBtn).toBeEnabled();

		await field(page, 'VLAN ID').fill('0');
		expect(await isEventuallyDisabled(addBtn), 'vid 0 must block').toBe(true);

		// 802.1Q reserves 4095; the gateway creates a bridge for any number, so
		// the form must bound the id with a visible reason.
		await field(page, 'VLAN ID').fill('4095');
		expect(await isEventuallyDisabled(addBtn), 'vid 4095 must block').toBe(true);
		await expect(dialog(page).getByText(/between 1 and 4094/)).toBeVisible();

		await field(page, 'VLAN ID').fill('4094');
		await expect(addBtn).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
	});
});
