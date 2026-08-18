//---------------------------------------------------------
// Endpoint page CRUD spec.
// POST /config/endpoint (create AND update reuse the same POST),
// DELETE /config/endpoint/epipaddress/{host}?name&probe_type&probe_port.
// Entities use e2e- names + reserved-documentation host IPs; the
// afterEach sweep removes leftovers.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {gw, sweepEndpoints} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const EP_PATH = '/config/endpoint';

//---------------------------------------------------------
// API seed (E/D fixtures)
//---------------------------------------------------------
interface SeedEp {
	hostName: string;
	name: string;
	probeType?: string;
	probePort?: number;
	probeDuration?: number;
	inactiveReTries?: number;
}

async function apiCreateEp(ep: SeedEp): Promise<void> {
	const resp = await gw('POST', EP_PATH, {
		hostName: ep.hostName,
		name: ep.name,
		probeType: ep.probeType ?? 'ping',
		probeDuration: ep.probeDuration ?? 60,
		inactiveReTries: ep.inactiveReTries ?? 2,
		...(ep.probePort !== undefined ? {probePort: ep.probePort} : {}),
	});
	expect(resp.status, `API seed create ${ep.name}`).toBeLessThan(300);
}

//---------------------------------------------------------
// UI helpers
//---------------------------------------------------------
async function openAddDialog(page: Page): Promise<void> {
	await openToolbarDialog(page, 'Add', 'New Endpoint');
}

/** Records DELETE /config/endpoint request URLs fired while `action` runs. */
async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(`${EP_PATH}/epipaddress`)) urls.push(new URL(r.url()));
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return urls;
}

//---------------------------------------------------------
// Suite
//---------------------------------------------------------
let instName: string;

test.describe('@loxilb Endpoint page CRUD', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
		await sweepEndpoints();
	});

	test.afterEach(async () => {
		await sweepEndpoints();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/endpoint?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: required host+name (ping default) — payload carries no client-side keys, then D-single', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Host Name').fill('203.0.113.20');
		await field(page, 'Name').fill('e2e-ep-min');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(EP_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();

		expect(body.hostName).toBe('203.0.113.20');
		expect(body.name).toBe('e2e-ep-min');
		// Probe Type dropdown defaults to ping.
		expect(body.probeType).toBe('ping');
		// The form's onChange validation state (isValid/errors) must never
		// leak into the POST payload.
		expect(body.isValid, 'isValid must not leak into the endpoint payload').toBeUndefined();
		expect(body.errors, 'errors must not leak into the endpoint payload').toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted endpoint create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, 'e2e-ep-min');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, 'e2e-ep-min');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain('/epipaddress/203.0.113.20');
		expect(deletes[0].searchParams.get('name')).toBe('e2e-ep-min');
		await refreshUntilGone(page, 'e2e-ep-min');
	});

	test('C-full: every IEndpointInput field lands in the POST body (http probe)', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Host Name').fill('203.0.113.21');
		await field(page, 'Name').fill('e2e-ep-full');
		await field(page, 'Inactive Retries').fill('5');
		await selectOption(page, 'Probe Type', 'HTTP'); // exact — must not hit HTTPS
		await field(page, 'Probe Duration').fill('30');
		await field(page, 'Probe Port').fill('8080');
		await field(page, 'Probe Request').fill('/health');
		await field(page, 'Probe Response').fill('OK');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(EP_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();

		expect(body).toMatchObject({
			hostName: '203.0.113.21',
			name: 'e2e-ep-full',
			inactiveReTries: 5,
			probeType: 'http',
			probeDuration: 30,
			probePort: 8080,
			probeReq: '/health',
			probeResp: 'OK',
		});
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted endpoint create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, 'e2e-ep-full');
	});

	test('E-update: edit re-POSTs with the host immutable and the changed probe fields', async ({page}) => {
		await apiCreateEp({hostName: '203.0.113.22', name: 'e2e-ep-edit', probeType: 'http', probePort: 8080, probeDuration: 60, inactiveReTries: 2});
		await refreshUntilRow(page, 'e2e-ep-edit');

		await selectRowByText(page, 'e2e-ep-edit');
		await openToolbarDialog(page, 'Mode', 'New Edit Endpoint'); // edit (pencil)

		// Host name is the identity in edit mode → disabled.
		await expect(field(page, 'Host Name')).toBeDisabled();

		await field(page, 'Probe Duration').fill('45');
		await field(page, 'Inactive Retries').fill('7');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(EP_PATH)),
			dialogButton(page, 'Update').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({hostName: '203.0.113.22', name: 'e2e-ep-edit', probeDuration: 45, inactiveReTries: 7});
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted endpoint update').toBeLessThan(300);
		await expect(dialog(page).getByText('Endpoint updated successfully.')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});

	test('V-host: empty and malformed host both block submit (name required too)', async ({page}) => {
		await openAddDialog(page);
		const addBtn = dialogButton(page, 'Add');

		// Empty host + empty name: form must block.
		expect(await isEventuallyDisabled(addBtn), 'empty host/name must block').toBe(true);

		// Fill a valid baseline so only the field under test is broken.
		await field(page, 'Host Name').fill('203.0.113.23');
		await field(page, 'Name').fill('e2e-ep-v');
		await expect(addBtn).toBeEnabled();

		// Clear the name → blocked (name is required).
		await field(page, 'Name').fill('');
		expect(await isEventuallyDisabled(addBtn), 'empty name must block').toBe(true);
		await field(page, 'Name').fill('e2e-ep-v');

		// Malformed host IP → blocked (Host Name is an ipaddress field on create).
		await field(page, 'Host Name').fill('999.1.1.1');
		expect(await isEventuallyDisabled(addBtn), 'bad host IP must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});

	test('V-probe-port: connect-type probes with no port block submit; PING does not', async ({page}) => {
		await openAddDialog(page);
		const addBtn = dialogButton(page, 'Add');

		await field(page, 'Host Name').fill('203.0.113.24');
		await field(page, 'Name').fill('e2e-ep-vport');
		// PING needs no port — baseline stays submittable.
		await expect(addBtn).toBeEnabled();

		// A connect-type probe without a port would program a health check that
		// can never succeed — the form must block and say why.
		await selectOption(page, 'Probe Type', 'HTTP'); // exact — must not hit HTTPS
		expect(await isEventuallyDisabled(addBtn), 'http probe with no port must block').toBe(true);
		await expect(dialog(page).getByText(/Probe Port \(1-65535\) is required/)).toBeVisible();

		// Providing a port unblocks.
		await field(page, 'Probe Port').fill('8080');
		await expect(addBtn).toBeEnabled();

		// Port 0 is not a usable probe target either.
		await selectOption(page, 'Probe Type', 'TCP');
		await field(page, 'Probe Port').fill('0');
		expect(await isEventuallyDisabled(addBtn), 'port 0 must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});

	test('D-multi: bulk delete fires one DELETE per selected endpoint', async ({page}) => {
		await apiCreateEp({hostName: '203.0.113.31', name: 'e2e-ep-d1'});
		await apiCreateEp({hostName: '203.0.113.32', name: 'e2e-ep-d2'});
		await apiCreateEp({hostName: '203.0.113.33', name: 'e2e-ep-d3'});

		await refreshUntilRow(page, 'e2e-ep-d1');
		await refreshUntilRow(page, 'e2e-ep-d3');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, 'e2e-ep-d1');
			await selectRowByText(page, 'e2e-ep-d2');
			await selectRowByText(page, 'e2e-ep-d3');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes, 'one DELETE per selected endpoint').toHaveLength(3);
		const names = deletes.map(u => u.searchParams.get('name')).sort();
		expect(names).toEqual(['e2e-ep-d1', 'e2e-ep-d2', 'e2e-ep-d3']);
		await refreshUntilGone(page, /e2e-ep-d[123]/);
	});
});
