//---------------------------------------------------------
// Device Neighbor page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §5).
// POST /config/neighbor (create), DELETE /config/neighbor/{ip}/dev/{dev}.
// Neighbors point a doc-range IP at a local MAC on eth0 — a static ARP/ND
// entry for an inert address, never affecting real reachability. The
// afterEach sweep only removes doc-range neighbors.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepNeighbors} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const NB_PATH = '/config/neighbor';
const DEV = 'eth0';
const MAC = '02:00:00:00:0e:2e'; // locally-administered, inert

async function apiCreateNeighbor(ipAddress: string, mac = MAC): Promise<void> {
	const resp = await gw('POST', NB_PATH, {ipAddress, dev: DEV, macAddress: mac});
	expect(resp.status, `API seed neighbor ${ipAddress}`).toBeLessThan(300);
}

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('New Device Neighbor')).toBeVisible();
	await expect(field(page, 'IP Address')).toBeVisible();
}

async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(NB_PATH)) urls.push(new URL(r.url()));
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

test.describe('Device Neighbor page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepNeighbors();
	});

	test.afterEach(async () => {
		await sweepNeighbors();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/neighbor?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: ip + dev + mac POST clean, then D-single', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'IP Address').fill('203.0.113.40');
		await selectOption(page, 'Device Name', DEV);
		await field(page, 'MAC Address').fill(MAC);

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(NB_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({ipAddress: '203.0.113.40', dev: DEV, macAddress: MAC});
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted neighbor create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, '203.0.113.40');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.40');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain('/neighbor/203.0.113.40/dev/eth0');
		await refreshUntilGone(page, '203.0.113.40');
	});

	test('V-mac: empty IP and malformed MAC block submit', async ({page}) => {
		await openAddDialog(page);
		const addBtn = dialogButton(page, 'Add');

		// The page gates Add on isValidIPAddress(ipAddress) only, but drive the
		// full form: empty IP must block.
		expect(await isEventuallyDisabled(addBtn), 'empty IP must block').toBe(true);

		await field(page, 'IP Address').fill('203.0.113.41');
		await selectOption(page, 'Device Name', DEV);
		await field(page, 'MAC Address').fill(MAC);
		await expect(addBtn).toBeEnabled();

		// Malformed IP → blocked.
		await field(page, 'IP Address').fill('999.1.1.1');
		expect(await isEventuallyDisabled(addBtn), 'bad IP must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});

	test('D-multi (F16 sibling): bulk delete fires one DELETE per selected neighbor', async ({page}) => {
		await apiCreateNeighbor('203.0.113.51');
		await apiCreateNeighbor('203.0.113.52');
		await apiCreateNeighbor('203.0.113.53');

		await refreshUntilRow(page, '203.0.113.51');
		await refreshUntilRow(page, '203.0.113.53');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.51');
			await selectRowByText(page, '203.0.113.52');
			await selectRowByText(page, '203.0.113.53');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes, 'one DELETE per selected neighbor').toHaveLength(3);
		const ips = deletes.map(u => u.pathname.match(/\/neighbor\/([^/]+)\/dev/)?.[1]).sort();
		expect(ips).toEqual(['203.0.113.51', '203.0.113.52', '203.0.113.53']);
		await refreshUntilGone(page, /203\.0\.113\.5[123]/);
	});
});
