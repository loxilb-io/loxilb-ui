//---------------------------------------------------------
// AI Gateway — Tenant Rate Limits page spec (docs/E2E_CRUD_TEST_PLAN.md
// §2.2). Menu-hidden route instance/ai/ratelimit.
//
// Same userservice split as apikey.spec: the gateway 501s /config/ai/*
// on the shared testbed, so upsert is skipped; render, the no-DELETE
// contract, and client-side validation always run.
//
// The gateway has no list-all for tenant rate limits (GET is per-tenant
// only) and NO delete — the UI must not offer a Delete affordance. The
// table shows only tenants seen on API keys plus session lookups, so on
// a fresh 501 testbed it is correctly empty.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance, gatewayLacksUserservice, gw} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {grid, rowByText, toolbarButton} from '../../helpers/table';

const RL_PATH = '/config/ai/tenant/ratelimit';

let instName: string;
let noUserservice: boolean;

test.describe('AI Tenant Rate Limit page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		noUserservice = await gatewayLacksUserservice();
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		consoleGuard.allow(/501/);
		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/ratelimit?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	});

	test('render: empty table + NO delete affordance (gateway has no DELETE), no crash', async ({page}) => {
		await expect(grid(page)).toBeVisible();
		await expect(grid(page).getByText('No rows')).toBeVisible();
		// The API exposes no delete — the toolbar must not offer one.
		await expect(page.locator('#table-bar button:has([data-testid="DeleteIcon"])')).toHaveCount(0);
		// Upsert (Add) + Edit are offered.
		await expect(toolbarButton(page, 'Add')).toBeEnabled();
	});

	test('lookup of an unknown tenant surfaces a Not Found popup, no crash', async ({page}) => {
		await page.getByLabel('Tenant ID lookup').fill('e2e-nonexistent-tenant');
		await page.getByRole('button', {name: 'Lookup'}).click();
		await expect(dialogTitle(page, 'Not Found')).toBeVisible({timeout: 10_000});
		await dialogButton(page, 'OK').click();
		await expect(dialog(page)).toBeHidden();
	});

	test('client validation: Apply requires a tenant; numeric limits clamp at 0 (never negative)', async ({page}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByRole('heading', {name: 'New AI Tenant Rate Limit'})).toBeVisible();

		const apply = dialogButton(page, 'Apply');
		await expect(apply).toBeDisabled();
		await field(page, 'Tenant ID').fill('e2e-tenant');
		await expect(apply).toBeEnabled();

		// The numeric TextBox clamps negatives to 0 on entry, so a rate can never
		// go below zero — typing -1 lands as 0 and the form stays valid.
		const rps = field(page, 'Rate Limit (req/s)');
		await rps.fill('-1');
		await rps.blur();
		await expect(rps).toHaveValue('0');
		await expect(apply).toBeEnabled();
	});

	test('E-upsert: POST upsert overwrites on re-apply (needs --userservice)', async ({page}) => {
		test.skip(noUserservice, 'gateway built without --userservice — /config/ai/* 501s');

		// First upsert.
		await toolbarButton(page, 'Add').click();
		await field(page, 'Tenant ID').fill('e2e-tenant');
		await field(page, 'Rate Limit (req/s)').fill('100');
		await page.mouse.move(0, 0);
		const [req1] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(RL_PATH)),
			dialogButton(page, 'Apply').click(),
		]);
		expect(req1.postDataJSON()).toMatchObject({tenant_id: 'e2e-tenant', rps: 100});
		expect(req1.postDataJSON().isValid).toBeUndefined();
		await expectSuccessAndDismiss(page);
		await toolbarButton(page, 'Refresh').click();
		await expect(rowByText(page, 'e2e-tenant').first()).toBeVisible({timeout: 10_000});

		// Re-apply with a changed rps → overwrite (upsert, not a second row).
		await rowByText(page, 'e2e-tenant').first().getByRole('checkbox').check();
		await toolbarButton(page, 'Mode').click();
		await field(page, 'Rate Limit (req/s)').fill('250');
		await page.mouse.move(0, 0);
		const [req2] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(RL_PATH)),
			dialogButton(page, 'Apply').click(),
		]);
		expect(req2.postDataJSON()).toMatchObject({tenant_id: 'e2e-tenant', rps: 250});
		await expectSuccessAndDismiss(page);

		const entry = await (await gw('GET', `${RL_PATH}/e2e-tenant`)).json();
		expect(entry.rps).toBe(250);
		await expect(rowByText(page, 'e2e-tenant')).toHaveCount(1);
	});
});
