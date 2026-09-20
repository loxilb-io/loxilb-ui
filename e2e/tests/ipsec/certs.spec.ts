//---------------------------------------------------------
// IPsec Certificate page CRUD spec.
// POST/DELETE /config/ipsec/{certificates,ca-certificates} +
// /certificates/validate. The page stacks two hideCheckbox tables:
// grid 0 = endpoint certificates, grid 1 = CA certificates.
//
// The PEM material is disposable self-signed RSA (see helpers/ipsec-pem)
// — it authenticates nothing and is swept after each test. The form is
// a plain JSON PEM-string upload (NOT multipart, despite the plan's
// wording — the gateway takes the PEM text in the body).
//
// Adversarial focus: V-garbage proves the client blocks non-PEM before
// it ever hits the wire, and every upload asserts no isValid key leaks
// into the payload.
//---------------------------------------------------------
import {Locator, Page, expect as base} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, sweepIpsecCerts} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, openDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {CA_CERT_PEM, EP_CERT_PEM, EP_KEY_PEM} from '../../helpers/ipsec-pem';

const CERT_PATH = '/config/ipsec/certificates';
const CA_PATH = '/config/ipsec/ca-certificates';

let instName: string;

//--- per-table scoping (two DataTables share the page) ----------------
// ⚠️ BY NAME, never by ordinal. Both grids and both toolbars are structurally
// identical, so `.nth(0)` / `.nth(1)` re-aim silently if the page ever reorders
// them or grows a third — and a *delete* would then land on the wrong table.
// These are DataTable's `name` props (IPsecCertTable.tsx).
const ENDPOINT = 'IPsec Certificates';
const CA = 'CA Certificates';
type CertTable = typeof ENDPOINT | typeof CA;

function tableGrid(page: Page, table: CertTable): Locator {
	return page.locator(`[data-table="${table}"] .MuiDataGrid-root`).first();
}
function toolbarBtn(page: Page, table: CertTable, icon: 'Add' | 'Delete' | 'Refresh'): Locator {
	return page.locator(`[data-table-bar="${table}"] button:has([data-testid="${icon}Icon"])`).first();
}
async function selectRowIn(page: Page, table: CertTable, text: string): Promise<void> {
	const row = tableGrid(page, table).locator('.MuiDataGrid-row').filter({hasText: text});
	await expect(row).toHaveCount(1);
	await row.locator('[data-field="name"]').first().click();
}
/** Refresh the given table until a row matching `text` is present / absent. */
async function refreshUntil(page: Page, table: CertTable, text: string, present: boolean): Promise<void> {
	for (let i = 0; i < 6; i++) {
		const count = await tableGrid(page, table).locator('.MuiDataGrid-row').filter({hasText: text}).count();
		if (present ? count > 0 : count === 0) return;
		await toolbarBtn(page, table, 'Refresh').click();
		await page.waitForTimeout(1200);
	}
	const finalCount = await tableGrid(page, table).locator('.MuiDataGrid-row').filter({hasText: text}).count();
	base(present ? finalCount > 0 : finalCount === 0, `row "${text}" ${present ? 'present' : 'gone'} in the ${table} grid`).toBeTruthy();
}

test.describe('@gw IPsec Certificate page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepIpsecCerts();
	});

	test.afterEach(async () => {
		await sweepIpsecCerts();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/ipsec/certs?name=${instName}`); // relative — see baseURL note
		await expect(toolbarBtn(page, ENDPOINT, 'Add')).toBeVisible({timeout: 20_000});
	});

	test('C-cert: endpoint cert PEM upload POSTs clean payload, lists, then D-single', async ({page}) => {
		await openDialog(page, dialog(page).getByRole('heading', {name: 'Upload IPsec Certificate'}), () => toolbarBtn(page, ENDPOINT, 'Add').click());

		await field(page, 'Name').fill('e2e-cert');
		await field(page, 'Description').fill('e2e disposable');
		await field(page, 'Certificate (PEM)').fill(EP_CERT_PEM);
		await field(page, 'Private Key (PEM)').fill(EP_KEY_PEM);

		await page.mouse.move(0, 0);
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(CERT_PATH)),
			dialogButton(page, 'Upload').click(),
		]);
		const body = req.postDataJSON();
		expect(body.name).toBe('e2e-cert');
		expect(body.certificate).toContain('BEGIN CERTIFICATE');
		expect(body.privateKey).toContain('PRIVATE KEY');
		expect(body.isValid).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted the cert').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntil(page, ENDPOINT, 'e2e-cert', true);
		// Parsed subject surfaces in the row.
		await expect(tableGrid(page, ENDPOINT).locator('.MuiDataGrid-row', {hasText: 'e2e-cert'}).first()).toContainText('e2e-ipsec-endpoint');

		await selectRowIn(page, ENDPOINT, 'e2e-cert');
		await toolbarBtn(page, ENDPOINT, 'Delete').click();
		await confirmDelete(page);
		await expectSuccessAndDismiss(page);
		await refreshUntil(page, ENDPOINT, 'e2e-cert', false);
	});

	test('V-garbage: non-PEM cert / key keeps Upload disabled (never hits the wire)', async ({page}) => {
		await openDialog(page, dialog(page).getByRole('heading', {name: 'Upload IPsec Certificate'}), () => toolbarBtn(page, ENDPOINT, 'Add').click());

		await field(page, 'Name').fill('e2e-garbage');
		await field(page, 'Certificate (PEM)').fill('this is not a certificate');
		await field(page, 'Private Key (PEM)').fill('nor a key');
		await expect(dialogButton(page, 'Upload')).toBeDisabled();

		// Real cert but still-garbage key → still blocked (both must be valid PEM).
		await field(page, 'Certificate (PEM)').fill(EP_CERT_PEM);
		await expect(dialogButton(page, 'Upload')).toBeDisabled();

		// Both valid → enabled.
		await field(page, 'Private Key (PEM)').fill(EP_KEY_PEM);
		await expect(dialogButton(page, 'Upload')).toBeEnabled();
	});

	test('Validate-on-gateway: parses the PEM and shows the subject without installing it', async ({page}) => {
		await toolbarBtn(page, ENDPOINT, 'Add').click();
		await field(page, 'Name').fill('e2e-valcheck');
		await field(page, 'Certificate (PEM)').fill(EP_CERT_PEM);
		await field(page, 'Private Key (PEM)').fill(EP_KEY_PEM);

		await dialog(page).getByRole('button', {name: 'Validate on Gateway'}).click();
		// The success Alert echoes the parsed subject + key algorithm.
		const alert = dialog(page).locator('.MuiAlert-root');
		await expect(alert).toBeVisible({timeout: 15_000});
		await expect(alert).toContainText('e2e-ipsec-endpoint');
		await expect(alert).toContainText('RSA');

		// Validation installs nothing — cancel out, the store stays empty.
		await dialogButton(page, 'Cancel').click();
		await expect(dialog(page)).toBeHidden();
	});

	test('C-ca: CA cert upload POSTs clean payload, lists, then D-single', async ({page}) => {
		await openDialog(page, dialog(page).getByRole('heading', {name: 'Upload CA Certificate'}), () => toolbarBtn(page, CA, 'Add').click());

		await field(page, 'Name').fill('e2e-ca');
		await field(page, 'CA Certificate (PEM)').fill(CA_CERT_PEM);

		await page.mouse.move(0, 0);
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(CA_PATH)),
			dialogButton(page, 'Upload').click(),
		]);
		const body = req.postDataJSON();
		expect(body.name).toBe('e2e-ca');
		expect(body.certificate).toContain('BEGIN CERTIFICATE');
		expect(body.isValid).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted the CA cert').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntil(page, CA, 'e2e-ca', true);
		await selectRowIn(page, CA, 'e2e-ca');
		await toolbarBtn(page, CA, 'Delete').click();
		await confirmDelete(page);
		await expectSuccessAndDismiss(page);
		await refreshUntil(page, CA, 'e2e-ca', false);
	});
});
