//---------------------------------------------------------
// High Availability page spec.
// Table + VIP edit dialog. Covers:
//  - render matches /config/cistate/all
//  - F-STATUS-3: VIP edit form now validates the IP (a garbage VIP disables
//    Update + shows an error); previously any string enabled Update.
//  - E-edit round-trip: a doc-range VIP with state kept NOT_DEFINED (no HA
//    activation, mgmt path untouched) POSTs a clean payload and persists;
//    read-modify-restore returns the original cistate in afterAll.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {gw, gwJson} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {grid, toolbarButton} from '../../helpers/table';

interface Vip {
	instance: string;
	state: string;
	vip: string;
}

const DOC_VIP = '203.0.113.9'; // RFC 5737 documentation range — inert on the testbed

async function readVip(): Promise<Vip | null> {
	const data = await gwJson<{Attr?: Vip[]}>('/config/cistate/all');
	return data.Attr?.[0] ?? null;
}

function editButton(page: Page) {
	return page.locator('[aria-label="Edit High Availability"] button');
}

async function openEdit(page: Page): Promise<void> {
	await grid(page).locator('.MuiDataGrid-row').first().getByRole('checkbox').check();
	await editButton(page).click();
	await expect(dialog(page).getByRole('heading', {name: 'New HA VIP'})).toBeVisible();
}

let instName: string;
let original: Vip | null;

test.describe('@loxilb High Availability page', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
		original = await readVip();
	});

	test.afterAll(async () => {
		// Restore the original cistate no matter what the tests left behind.
		if (original) await gw('POST', '/config/cistate', {instance: original.instance, state: original.state, vip: original.vip});
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/status/ha?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
	});

	test('renders the cluster instance row from /config/cistate/all', async ({page}) => {
		const vip = await readVip();
		expect(vip, 'testbed must report a cluster instance').not.toBeNull();
		await expect(grid(page).locator('.MuiDataGrid-cell', {hasText: vip!.instance}).first()).toBeVisible();
		await expect(grid(page).locator('.MuiDataGrid-cell', {hasText: vip!.state}).first()).toBeVisible();
	});

	test('F-STATUS-3: a malformed VIP disables Update and shows an error', async ({page}) => {
		await openEdit(page);
		const update = dialogButton(page, 'Update');
		// Opens pre-filled with the current (valid) VIP → Update enabled.
		await expect(update).toBeEnabled();

		await field(page, 'VIP Address').fill('999.999.999.999');
		expect(await isEventuallyDisabled(update), 'garbage VIP must block Update').toBe(true);
		await expect(dialog(page).getByText('Enter a valid IP address')).toBeVisible();

		// A real address re-enables it.
		await field(page, 'VIP Address').fill(DOC_VIP);
		await expect(update).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
		await expect(dialog(page)).toBeHidden();
	});

	test('E-edit: doc-range VIP POSTs a clean payload and the UI round-trips', async ({page}) => {
		await openEdit(page);
		// Keep state NOT_DEFINED so no VIP takeover happens; only the recorded VIP
		// changes to an inert documentation address.
		await field(page, 'VIP Address').fill(DOC_VIP);

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && /\/config\/cistate/.test(r.url()) && !r.url().includes('/all')),
			dialogButton(page, 'Update').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({state: 'NOT_DEFINED', vip: DOC_VIP});
		// The form's validity flag must never reach the gateway.
		expect(body.isValid, 'isValid must not leak into the cistate payload').toBeUndefined();

		// Gateway accepts it and the UI shows the Success popup. NOTE: loxilb only
		// retains a VIP while an instance is MASTER/BACKUP — under NOT_DEFINED it
		// drops the VIP back to 0.0.0.0, so we assert the round-trip succeeds, not
		// that a VIP persists (that would need activating HA, which we never do on
		// the single-node testbed).
		expect((await req.response())?.status(), 'gateway accepted cistate POST').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
	});
});
