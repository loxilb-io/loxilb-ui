//---------------------------------------------------------
// Route page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §5).
// POST /config/route (create), DELETE /config/route/destinationIPNet/{ip}/{mask}.
// Every route targets the RFC-5737 203.0.113.0/24 documentation range via the
// on-link gateway 10.0.0.1 — inert (no real traffic is destined there), and the
// afterEach sweep only ever removes doc-range routes.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepRoutes} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const ROUTE_PATH = '/config/route';
const GW = '10.0.0.1'; // on-link nexthop on the testbed

async function apiCreateRoute(destinationIPNet: string): Promise<void> {
	const resp = await gw('POST', ROUTE_PATH, {destinationIPNet, gateway: GW});
	expect(resp.status, `API seed route ${destinationIPNet}`).toBeLessThan(300);
}

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('New Route')).toBeVisible();
	await expect(field(page, 'Gateway')).toBeVisible(); // metadata form finished loading
}

/** Records DELETE /config/route request URLs fired while `action` runs. */
async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(`${ROUTE_PATH}/destinationIPNet`)) urls.push(new URL(r.url()));
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

test.describe('Route page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepRoutes();
	});

	test.afterEach(async () => {
		await sweepRoutes();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/route?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: dest + gateway POST clean, no protocol key, then D-single', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Destination IP/Netmask').fill('203.0.113.0/26');
		await field(page, 'Gateway').fill(GW);

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(ROUTE_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body.destinationIPNet).toBe('203.0.113.0/26');
		expect(body.gateway).toBe(GW);
		// Protocol defaults to None → the connector must omit an empty protocol.
		expect(body.protocol, 'empty protocol must be omitted').toBeUndefined();
		// Regression guard: the metadata form must not leak validation flags.
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted route create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, '203.0.113.0/26');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.0/26');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain('/destinationIPNet/203.0.113.0/26');
		await refreshUntilGone(page, '203.0.113.0/26');
	});

	test('C-proto: static protocol lands in the POST body', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Destination IP/Netmask').fill('203.0.113.64/26');
		await field(page, 'Gateway').fill(GW);
		await selectOption(page, 'Protocol', 'Static');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(ROUTE_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({destinationIPNet: '203.0.113.64/26', gateway: GW, protocol: 'static'});

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted route create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, '203.0.113.64/26');
	});

	test('V-dest: bad prefix and empty gateway both block submit', async ({page}) => {
		await openAddDialog(page);
		const addBtn = dialogButton(page, 'Add');

		// Baseline valid → enabled.
		await field(page, 'Destination IP/Netmask').fill('203.0.113.0/26');
		await field(page, 'Gateway').fill(GW);
		await expect(addBtn).toBeEnabled();

		// Missing mask → not a valid CIDR → blocked.
		await field(page, 'Destination IP/Netmask').fill('203.0.113.0');
		expect(await isEventuallyDisabled(addBtn), 'dest without mask must block').toBe(true);
		await field(page, 'Destination IP/Netmask').fill('203.0.113.0/26');

		// Empty gateway → blocked.
		await field(page, 'Gateway').fill('');
		expect(await isEventuallyDisabled(addBtn), 'empty gateway must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});

	test('D-multi (F16 sibling): bulk delete fires one DELETE per selected route', async ({page}) => {
		await apiCreateRoute('203.0.113.128/26');
		await apiCreateRoute('203.0.113.192/26');
		await apiCreateRoute('198.51.100.0/26');

		await refreshUntilRow(page, '203.0.113.128/26');
		await refreshUntilRow(page, '198.51.100.0/26');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.128/26');
			await selectRowByText(page, '203.0.113.192/26');
			await selectRowByText(page, '198.51.100.0/26');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes, 'one DELETE per selected route').toHaveLength(3);
		await refreshUntilGone(page, /(203\.0\.113\.(128|192)|198\.51\.100\.0)\/26/);
	});
});
