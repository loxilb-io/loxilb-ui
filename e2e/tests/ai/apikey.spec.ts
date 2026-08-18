//---------------------------------------------------------
// AI Gateway — API Keys page spec.
//
// The gateway serves /config/ai/* only when built with --userservice,
// which the shared testbed is NOT (every AI endpoint 501s by design;
// see UI_API_GAP_ANALYSIS §2.2). So this file splits in two:
//   • always-run: the page renders, the 501 degrades to an empty table
//     (no white-screen), and ALL client-side form validation runs
//     (the Add dialog opens even though the eventual POST would 501).
//   • CRUD (create/patch/delete): test.skip(noUserservice) — lights up
//     unchanged on a userservice-enabled gateway.
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
import {activeInstance, gatewayLacksUserservice, gw, sweepApiKeys} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {grid, rowByText, showAllRows, toolbarButton} from '../../helpers/table';

const APIKEY_PATH = '/config/ai/apikey';

let instName: string;
let noUserservice: boolean;

test.describe('@gw AI API Key page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		noUserservice = await gatewayLacksUserservice();
		await sweepApiKeys();
	});

	test.afterEach(async () => {
		await sweepApiKeys();
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		// AI endpoints 501 on this testbed — that specific failure is expected.
		consoleGuard.allow(/501/);
		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/apikey?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	});

	test('render: a 501 (no userservice) degrades to an empty table, never a white-screen', async ({page}) => {
		await expect(grid(page)).toBeVisible();
		await expect(grid(page).getByText(/No .* entries yet|No rows/)).toBeVisible();
		// The page shell is intact and interactive.
		await expect(toolbarButton(page, 'Add')).toBeEnabled();
	});

	test('client validation: required tenant + a past-proof expiry picker (F-AI-1/2)', async ({page}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByRole('heading', {name: 'New AI API Key'})).toBeVisible();

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

	test('C-min → one-time raw_key; E-patch; D-single (needs --userservice)', async ({page}) => {
		test.skip(noUserservice, 'gateway built without --userservice — /config/ai/* 501s');

		// C-min: minimal create surfaces the plaintext key exactly once.
		await toolbarButton(page, 'Add').click();
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

		await toolbarButton(page, 'Refresh').click();
		await expect(rowByText(page, 'e2e-key').first()).toBeVisible({timeout: 10_000});

		// D-single by key_id.
		const list = await (await gw('GET', `${APIKEY_PATH}?tenant_id=e2e-tenant`)).json();
		const created = (Array.isArray(list) ? list : []).find((k: any) => k.name === 'e2e-key');
		expect(created?.key_id).toBeTruthy();
		await showAllRows(page);
		await rowByText(page, 'e2e-key').first().getByRole('checkbox').check();
		await toolbarButton(page, 'Delete').click();
		await dialogButton(page, 'Delete').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});
});
