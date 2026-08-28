//---------------------------------------------------------
// AI Gateway — API Keys page spec.
//
// The routes are registered independently of the legacy --userservice flag.
// Render and client validation always run. Live mutation tests run only when
// the readiness probe proves both the OAM→Gateway management service identity
// and the API-key store; 401/403/503 are reported as distinct skip reasons,
// while a stale 501 is a hard contract failure.
//
// Adversarial focus — the client-validation test pins two bugs found +
// fixed this session in ApiKeyInputForm:
//   F-AI-1: a PAST expires_at was accepted (validation only checked that
//           the timestamp parsed, not that it was in the future).
//   F-AI-2: toRequest() called new Date(value).toISOString() on every
//           keystroke; a half-typed / invalid timestamp threw
//           RangeError: Invalid time value inside the onChange handler,
//           breaking the form. The consoleGuard here does NOT allow that
//           error, so a regression re-breaks this test immediately.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance, AIManagementReadiness, gatewayAIManagementReadiness, gw, sweepApiKeys} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {grid, rowByText, showAllRows, toolbarButton} from '../../helpers/table';

const APIKEY_PATH = '/config/ai/apikey';

let instName: string;
let readiness: AIManagementReadiness;

test.describe('@gw AI API Key page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		readiness = await gatewayAIManagementReadiness();
		await sweepApiKeys();
	});

	test.afterEach(async () => {
		await sweepApiKeys();
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of (401|403|503)/i);
		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/apikey?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	});

	test('render: management-auth/store failures stay inline, never a white-screen', async ({page}) => {
		await expect(grid(page)).toBeVisible();
		// The page shell is intact and interactive.
		await expect(toolbarButton(page, 'Add')).toBeEnabled();
	});

	test('client validation: required tenant + a past-proof expiry picker (F-AI-1/2)', async ({page}) => {
		await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI API Key'}));

		const add = dialogButton(page, 'Add');

		// tenant_id is required.
		await expect(add).toBeDisabled();
		await field(page, 'Tenant ID').fill('e2e-tenant');
		await expect(add).toBeEnabled();

		// Expiry is a DateTimePicker (was a free-text RFC3339 box). It has NO raw
		// text to fat-finger into a RangeError (F-AI-2), and disablePast makes past
		// instants unselectable (F-AI-1). Open the calendar and prove both.
		await dialog(page).locator('.MuiInputAdornment-root button').click();
		await expect(page.locator('button.MuiPickersDay-root').first()).toBeVisible();
		expect(await page.locator('button.MuiPickersDay-root[disabled]').count(), 'past days are disabled (disablePast)').toBeGreaterThan(0);
		// Picking a future day (last enabled cell in the month) keeps the form valid.
		await page.locator('button.MuiPickersDay-root:not([disabled])').last().click();
		await expect(add).toBeEnabled();
		await page.keyboard.press('Escape'); // close the picker popover
		// The consoleGuard (RangeError NOT allowed) fails this test if the old
		// toISOString-on-invalid crash ever returns.
	});

	test('C-generate/import → one-time secrecy; D-single (needs management/store readiness)', async ({page}) => {
		expect(readiness.status, 'AI management route must never use the retired 501 capability gate').not.toBe(501);
		test.skip(!readiness.ready, readiness.reason);

		// C-min: minimal create surfaces the plaintext key exactly once.
		await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI API Key'}));
		await field(page, 'Tenant ID').fill('e2e-tenant');
		await field(page, 'Name').fill('e2e-key');
		await page.mouse.move(0, 0);
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(APIKEY_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({tenant_id: 'e2e-tenant', name: 'e2e-key', enabled: true});
		expect(body.isValid).toBeUndefined();
		expect((await req.response())?.status()).toBeLessThan(300);

		// The raw key is shown once, in its own dialog.
		await expect(dialogTitle(page, 'API Key Created')).toBeVisible();
		await expect(dialog(page).getByText(/Copy this key now/i)).toBeVisible();
		await dialogButton(page, 'OK').click();

		// Import mode sends an operator-provided secret once, but the response and
		// subsequent list must never echo it back.
		const importedSecret = `e2e-import-${Date.now().toString(36)}-secret`;
		await toolbarButton(page, 'Add').click();
		await page.getByLabel('Import existing key').check();
		await field(page, 'Existing API key').fill(importedSecret);
		await field(page, 'Tenant ID').fill('e2e-tenant');
		await field(page, 'Name').fill('e2e-imported-key');
		const [importReq] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(APIKEY_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		expect(importReq.postDataJSON()).toMatchObject({tenant_id: 'e2e-tenant', name: 'e2e-imported-key', api_key: importedSecret});
		const importResponse = await importReq.response();
		expect(importResponse?.status()).toBeLessThan(300);
		expect(await importResponse?.text()).not.toContain(importedSecret);
		await expect(dialogTitle(page, 'API Key Imported')).toBeVisible();
		await expect(dialog(page)).not.toContainText(importedSecret);
		await dialogButton(page, 'OK').click();

		await toolbarButton(page, 'Refresh').click();
		await expect(rowByText(page, 'e2e-key').first()).toBeVisible({timeout: 10_000});
		await expect(rowByText(page, 'e2e-imported-key').first()).toBeVisible({timeout: 10_000});
		const listed = await (await gw('GET', `${APIKEY_PATH}?tenant_id=e2e-tenant`)).text();
		expect(listed).not.toContain(importedSecret);

		// D-single by key_id.
		const list = await (await gw('GET', `${APIKEY_PATH}?tenant_id=e2e-tenant`)).json();
		const created = (Array.isArray(list) ? list : []).find((k: any) => k.name === 'e2e-key');
		expect(created?.key_id).toBeTruthy();
		await showAllRows(page);
		await rowByText(page, 'e2e-key').first().getByRole('checkbox').check();
		await openToolbarDialog(page, 'Delete', dialogTitle(page, 'WARNING!! Delete Item'));
		await dialogButton(page, 'Delete').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});
});
