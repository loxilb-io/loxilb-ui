//---------------------------------------------------------
// VLAN page spec.
// POST /config/vlan (create), DELETE /config/vlan/{vid}. Members live in a
// sub-panel: POST /config/vlan/{vid}/member, DELETE .../member/{dev}/tagged/{t}.
// Uses reserved vid 3999 (real testbed VLANs are 380x) and a tagged member on
// eth0 (non-disruptive to untagged mgmt traffic). afterEach sweeps test vids.
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {gw, gwJson, primaryNetworkDevice, sweepVlans, TEST_VLAN_IDS} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const VLAN_PATH = '/config/vlan';

// The two reserved vids this spec uses are CHOSEN AT RUNTIME from the free
// entries in TEST_VLAN_IDS, never hardcoded.
//
// Why: upstream loxilb can leave a vid permanently wedged — still listed by
// GET /config/vlan/all, but every DELETE (member and vlan alike) answers
// 404 "Link not found", because its kernel link is gone while loxilb's own
// table still has the row. Once that happens the vid is unusable forever and
// a hardcoded one makes the whole spec un-rerunnable on that testbed. (3999
// was burned that way during bring-up; 3991 followed on the loxilb box on
// 2026-08-18.) Picking a free vid turns a mystifying flake into either a
// green run or a named, actionable failure when the pool runs out.
let VID = 0;
let MEMBER_VID = 0;
let MEMBER_BASE_DEV = '';

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

test.describe('@loxilb VLAN page CRUD', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
		const preferredDevice = await primaryNetworkDevice();
		const ports = await gwJson<{portAttr?: Array<{portName?: string; portL2Information?: {vid?: number}}>}>('/config/port/all');
		// A port already enslaved to a PVID cannot safely host this temporary
		// tagged member. Use an eligible physical interface or skip explicitly.
		MEMBER_BASE_DEV = (ports.portAttr ?? []).find(port => port.portName === preferredDevice && !port.portL2Information?.vid)?.portName ?? '';
		await sweepVlans();

		// Whatever the sweep could not remove is wedged — skip those.
		const existing = new Set(((await gwJson<{vlanAttr?: Array<{vid: number}>}>(`${VLAN_PATH}/all`)).vlanAttr ?? []).map(v => v.vid));
		const free = TEST_VLAN_IDS.filter(vid => !existing.has(vid));
		expect(
			free.length,
			`the reserved test-VLAN pool is exhausted on this instance — ${TEST_VLAN_IDS.filter(v => existing.has(v)).join(', ')} are still present and could not be swept (wedged upstream: listed by GET, 404 on DELETE). Widen TEST_VLAN_IDS in helpers/api.ts or rebuild the instance.`,
		).toBeGreaterThanOrEqual(2);
		[VID, MEMBER_VID] = free;
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
		await openToolbarDialog(page, 'Add', 'New VLAN');
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

	test('V-member-delete: a tagged member deletes via the base device name', async ({page}) => {
		test.skip(!MEMBER_BASE_DEV, 'testbed has no unassigned physical interface available for a temporary tagged VLAN member');
		const memberDev = `${MEMBER_BASE_DEV}.${MEMBER_VID}`;
		// Seed vlan + tagged member via API; the gateway lists the member as
		// "<dev>.<vid>", but its delete endpoint only accepts the base device.
		expect((await gw('POST', VLAN_PATH, {vid: MEMBER_VID})).status).toBeLessThan(300);
		expect((await gw('POST', `${VLAN_PATH}/${MEMBER_VID}/member`, {dev: MEMBER_BASE_DEV, tagged: true})).status).toBeLessThan(300);

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
		// The DELETE uses the base device, not the suffixed name the grid shows.
		expect(deletes[0].pathname).toContain(`/vlan/${MEMBER_VID}/member/${MEMBER_BASE_DEV}/tagged/true`);
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
		await openToolbarDialog(page, 'Add', 'New VLAN');
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
