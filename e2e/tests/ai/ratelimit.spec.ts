//---------------------------------------------------------
// AI Gateway — Tenant Rate Limits page spec. Menu-hidden route
// instance/ai/ratelimit.
//
// Render, the no-DELETE contract, and client-side validation always run.
// Upsert runs only after the same management-identity + store readiness probe
// used by the API-key suite; the legacy userservice/501 gate is invalid.
//
// The gateway has no list-all for tenant rate limits (GET is per-tenant
// only) and NO delete — the UI must not offer a Delete affordance. The
// table shows only tenants seen on API keys plus session lookups.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance, AIManagementReadiness, gatewayAIManagementReadiness, gw} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {grid, rowByText, toolbarButton} from '../../helpers/table';

const RL_PATH = '/config/ai/tenant/ratelimit';
const RATE_LIMIT_RUN_ID = `${Date.now().toString(36)}-${process.pid}`;

async function neutralizeRateLimit(tenantId: string, models: string[]): Promise<void> {
	const response = await gw('POST', RL_PATH, {
		tenant_id: tenantId,
		rps: 0,
		tokens_per_min: 0,
		burst_pct: 0,
		model_limits: models.map(model => ({model, tokens_per_min: 0})),
	});
	if (!response.ok) {
		const details = await response.text().catch(() => '');
		throw new Error(`Failed to neutralize rate limit for ${tenantId}: HTTP ${response.status}${details ? ` ${details}` : ''}`);
	}
}

let instName: string;
let readiness: AIManagementReadiness;

test.describe('@gw AI Tenant Rate Limit page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		readiness = await gatewayAIManagementReadiness();
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of (401|403|503)/i);
		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/ratelimit?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	});

	test('render: empty table + NO delete affordance (gateway has no DELETE), no crash', async ({page}) => {
		await expect(grid(page)).toBeVisible();
		await expect(grid(page).getByText(/No .* entries yet|No rows/)).toBeVisible();
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

	test('client validation: invalid numbers and duplicate model quotas block Apply', async ({page}) => {
		await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI Tenant Rate Limit'}));

		const apply = dialogButton(page, 'Apply');
		await expect(apply).toBeDisabled();
		await field(page, 'Tenant ID').fill('e2e-tenant');
		await expect(apply).toBeEnabled();

		const rps = field(page, 'Rate Limit (req/s)');
		await rps.fill('-1');
		await expect(apply).toBeDisabled();
		await rps.fill('0');
		await expect(apply).toBeEnabled();

		await page.getByRole('button', {name: 'Add model quota'}).click();
		await expect(apply).toBeDisabled();
		await field(page, 'Model').fill('llama-70b');
		await field(page, 'Model Tokens / Minute').fill('500');
		await expect(apply).toBeEnabled();

		await page.getByRole('button', {name: 'Add model quota'}).click();
		await field(page, 'Model').nth(1).fill('llama-70b');
		await field(page, 'Model Tokens / Minute').nth(1).fill('250');
		await expect(dialog(page).getByText(/duplicated/i)).toBeVisible();
		await expect(apply).toBeDisabled();
	});

	test('E-upsert: POST round-trips burst_pct and overwrites on re-apply', async ({page}, testInfo) => {
		expect(readiness.status, 'AI management route must never use the retired 501 capability gate').not.toBe(501);
		test.skip(!readiness.ready, readiness.reason);
		const tenantId = `e2e-ratelimit-${RATE_LIMIT_RUN_ID}-${testInfo.workerIndex}-${testInfo.retry}`;
		const model = 'llama-70b';
		let primaryFailure: unknown;
		testInfo.annotations.push({type: 'tenant', description: tenantId});

		try {
			// First upsert.
			await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI Tenant Rate Limit'}));
			await field(page, 'Tenant ID').fill(tenantId);
			await field(page, 'Rate Limit (req/s)').fill('100');
			await field(page, 'Burst Percentage').fill('175');
			await page.getByRole('button', {name: 'Add model quota'}).click();
			await field(page, 'Model').fill(model);
			await field(page, 'Model Tokens / Minute').fill('500');
			await page.mouse.move(0, 0);
			const [req1] = await Promise.all([
				page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(RL_PATH)),
				dialogButton(page, 'Apply').click(),
			]);
			expect(req1.postDataJSON()).toMatchObject({
				tenant_id: tenantId,
				rps: 100,
				burst_pct: 175,
				model_limits: [{model, tokens_per_min: 500}],
			});
			expect(req1.postDataJSON().isValid).toBeUndefined();
			await expectSuccessAndDismiss(page);
			await toolbarButton(page, 'Refresh').click();
			await expect(rowByText(page, tenantId).first()).toBeVisible({timeout: 10_000});

			// Re-apply with a changed rps → overwrite (upsert, not a second row).
			await rowByText(page, tenantId).first().getByRole('checkbox').check();
			await toolbarButton(page, 'Mode').click();
			await field(page, 'Rate Limit (req/s)').fill('250');
			await page.mouse.move(0, 0);
			const [req2] = await Promise.all([
				page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(RL_PATH)),
				dialogButton(page, 'Apply').click(),
			]);
			expect(req2.postDataJSON()).toMatchObject({tenant_id: tenantId, rps: 250});
			await expectSuccessAndDismiss(page);

			const entry = await (await gw('GET', `${RL_PATH}/${encodeURIComponent(tenantId)}`)).json();
			expect(entry).toMatchObject({rps: 250, burst_pct: 175});
			await expect(rowByText(page, tenantId)).toHaveCount(1);
		} catch (error) {
			primaryFailure = error;
			throw error;
		} finally {
			try {
				// The API has no DELETE. Zero removes each model quota and leaves
				// only an inert, run-identifiable tenant row if the DB retains it.
				await neutralizeRateLimit(tenantId, [model]);
			} catch (cleanupError) {
				if (primaryFailure) {
					console.warn(`Rate-limit cleanup also failed for ${tenantId}:`, cleanupError);
				} else {
					throw cleanupError;
				}
			}
		}
	});
});
