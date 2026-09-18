//---------------------------------------------------------
// AI per-user rate limits — the Stage 4.2 section of the (menu-hidden)
// Tenant Rate Limits page, route instance/ai/ratelimit.
//
// LIVE, not mocked, because it can be: the testbed gateway now has a
// configured PostgreSQL key store, so the user-quota routes answer instead of
// 503. The readiness probe still gates it, so this skips rather than fails on
// a gateway without one.
//
// ⚠️ THE PAGE NOW HAS TWO GRIDS, and the shared helpers (`grid`,
// `toolbarButton`, `rowByText`) all resolve `.first()` — i.e. the TENANT table
// above. Every locator here is therefore scoped through the toolbar buttons'
// `aria-label`, which DataTable builds from its `name` ("Add AI User Rate
// Limits"), and through the user grid's own root. Using the bare helpers in
// this file would silently drive the wrong table.
//---------------------------------------------------------
import type {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, AIManagementReadiness, gatewayAIManagementReadiness, gw} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const APIKEY_PATH = '/config/ai/apikey';
const USER_RL_PATH = '/config/ai/user/ratelimit';
const RUN_ID = `${Date.now().toString(36)}-${process.pid}`;

let instName: string;
let readiness: AIManagementReadiness;

// The user table is the SECOND DataTable on the page. Scope by its name.
const userToolbar = (page: Page, action: string): Locator =>
	page.getByRole('button', {name: `${action} AI User Rate Limits`});

// The user grid: the last grid root on the page, since the section renders
// below the tenant table.
const userGrid = (page: Page): Locator => page.locator('.MuiDataGrid-root').last();

const userRow = (page: Page, text: string | RegExp): Locator =>
	userGrid(page).locator('.MuiDataGrid-row').filter({hasText: text});

test.describe('@gw AI per-user rate limits', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		readiness = await gatewayAIManagementReadiness();
	});

	test('UR-E2E-1: a user override is added, listed and deleted, and absence reads as inheritance', async ({page, consoleGuard}, testInfo) => {
		test.skip(!readiness.ready, readiness.reason);
		consoleGuard.allow(/status of (401|403|404|503)/i);
		consoleGuard.allow(/Failed to load resource/i);

		const tenantId = `e2e-userrl-${RUN_ID}-${testInfo.workerIndex}-${testInfo.retry}`;
		const userId = `subject-${testInfo.workerIndex}`;
		testInfo.annotations.push({type: 'tenant', description: tenantId});

		// Seed the tenant the only way the page can learn one: the tenant set is
		// derived from the tenants seen on API KEYS (there is no list-all for
		// tenant rate limits), so a key is what makes the tenant selectable.
		const created = await gw('POST', APIKEY_PATH, {tenant_id: tenantId, name: tenantId, enabled: true});
		expect(created.ok, 'seeding an API key must succeed once the key store is configured').toBe(true);
		const keyId = (await created.json()).key_id as string;

		try {
			await page.goto(`instance/ai/ratelimit?name=${instName}`);

			// The selector defaults to the first known tenant; ours may not be it.
			const selector = page.getByRole('combobox', {name: /per-user limits for tenant/i});
			await expect(selector).toBeVisible({timeout: 20_000});
			await selector.click();
			await page.getByRole('option', {name: tenantId, exact: true}).click();

			// ⭐ Absence is INHERITANCE, and the page must say so rather than
			// leaving the grid's bare "No rows" to imply nobody is limited.
			await expect(page.getByText(/no user in this tenant has an explicit override/i)).toBeVisible({timeout: 15_000});

			//---------------------------------------------------------
			// The all-zero refusal
			//---------------------------------------------------------
			await userToolbar(page, 'Add').click();
			// NewBox titles an add form "New <item_name>"; the item name here is
			// "User Rate Limit".
			await expect(dialog(page).getByRole('heading', {name: /New User Rate Limit/i})).toBeVisible();
			await field(page, 'User ID').fill(userId);

			// Every limit is still 0. On this endpoint a zero FALLS THROUGH to
			// the configured defaults, so the entry asks for nothing and the
			// gateway refuses it 400 — the UI must refuse it first and explain
			// that Delete, not zeroing, is how limits are removed.
			await expect(dialog(page).getByText(/would constrain nothing/i)).toBeVisible();
			await expect(dialogButton(page, 'Apply')).toBeDisabled();

			//---------------------------------------------------------
			// A real limit
			//---------------------------------------------------------
			await field(page, 'Tokens per Minute').first().fill('1500');
			await page.mouse.move(0, 0);
			await expect(dialogButton(page, 'Apply')).toBeEnabled();

			const [request] = await Promise.all([
				page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(USER_RL_PATH)),
				dialogButton(page, 'Apply').click(),
			]);
			expect(request.postDataJSON()).toMatchObject({tenant_id: tenantId, user_id: userId, tokens_per_min: 1500});
			// The form's own validity flag must never reach the gateway.
			expect(request.postDataJSON().isValid).toBeUndefined();
			await expectSuccessAndDismiss(page);

			await expect(userRow(page, userId).first()).toBeVisible({timeout: 15_000});
			// With an explicit row present, the inheritance notice is gone.
			await expect(page.getByText(/no user in this tenant has an explicit override/i)).toHaveCount(0);

			//---------------------------------------------------------
			// Delete restores inheritance
			//---------------------------------------------------------
			await userRow(page, userId).first().getByRole('checkbox').check();
			await userToolbar(page, 'Delete').click();
			// DataTable confirms destructive actions.
			const confirm = dialogButton(page, 'Delete');
			if (await confirm.isVisible().catch(() => false)) await confirm.click();
			await expectSuccessAndDismiss(page);

			await expect(userRow(page, userId)).toHaveCount(0, {timeout: 15_000});
			// ⭐ Back to inheritance, which is the honest reading of an empty list.
			await expect(page.getByText(/no user in this tenant has an explicit override/i)).toBeVisible({timeout: 15_000});
		} finally {
			// Leave the shared bed as we found it, whatever happened above.
			await gw('DELETE', `${USER_RL_PATH}/${encodeURIComponent(tenantId)}/${encodeURIComponent(userId)}`).catch(() => undefined);
			await gw('DELETE', `${APIKEY_PATH}/${encodeURIComponent(keyId)}`).catch(() => undefined);
		}
	});
});
