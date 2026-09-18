//---------------------------------------------------------
// AI rate-limit defaults — the Stage 4.2b section of the (menu-hidden)
// Tenant Rate Limits page, route instance/ai/ratelimit.
//
// LIVE, because the testbed gateway has a configured PostgreSQL key store and
// the defaults routes therefore answer instead of 503. The readiness probe
// gates it, so this skips rather than fails on a gateway without one.
//
// ⚠️⚠️ THIS SPEC ONLY EVER TOUCHES A `rule` ROW WITH A RUN-UNIQUE SERVICE NAME,
// never the `global` row. The global row is SHARED, UNPARTITIONED state: there
// is exactly one of it per gateway, it governs every identity that has no
// entry of its own, and writing it would change what every other test on the
// bed is subject to — including the token-quota panel's verdict. A rule row is
// the only part of this surface a test can own.
//
// ⚠️ Locators are scoped by `data-table`, not by position. This page has three
// grids and `.first()`/`.last()` silently re-aim when one is added.
//---------------------------------------------------------
import type {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, AIManagementReadiness, gatewayAIManagementReadiness, gw} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const DEFAULTS_PATH = '/config/ai/ratelimit/defaults';
const RUN_ID = `${Date.now().toString(36)}-${process.pid}`;

let instName: string;
let readiness: AIManagementReadiness;

const defaultsTable = (page: Page): Locator => page.locator('[data-table="AI Rate Limit Defaults"]');

const defaultsToolbar = (page: Page, action: string): Locator =>
	defaultsTable(page).getByRole('button', {name: `${action} AI Rate Limit Defaults`});

const defaultsRow = (page: Page, text: string | RegExp): Locator =>
	defaultsTable(page).locator('.MuiDataGrid-row').filter({hasText: text});

test.describe('@gw AI rate-limit defaults', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		readiness = await gatewayAIManagementReadiness();
	});

	test('RD-E2E-1: a per-service defaults row is added, edited whole, and deleted', async ({page, consoleGuard}, testInfo) => {
		test.skip(!readiness.ready, readiness.reason);
		consoleGuard.allow(/status of (401|403|404|503)/i);
		consoleGuard.allow(/Failed to load resource/i);

		const service = `e2e-rldef-${RUN_ID}-${testInfo.workerIndex}-${testInfo.retry}`;
		testInfo.annotations.push({type: 'service', description: service});

		try {
			await page.goto(`instance/ai/ratelimit?name=${instName}`);
			await expect(defaultsTable(page)).toBeVisible({timeout: 20_000});

			//---------------------------------------------------------
			// A service with no row INHERITS — it is not "missing"
			//---------------------------------------------------------
			await page.getByLabel(/service lookup/i).fill(service);
			await page.getByRole('button', {name: /^lookup$/i}).last().click();
			// ⭐ The wording is the assertion. A service with no row is the normal
			// case and uses the global defaults; calling it "not found" full stop
			// would invite an operator to create a row they do not need.
			await expect(page.getByText(/uses the global defaults/i)).toBeVisible({timeout: 15_000});
			await page.getByRole('button', {name: /^ok$/i}).click();

			//---------------------------------------------------------
			// The all-zero refusal
			//---------------------------------------------------------
			await defaultsToolbar(page, 'Add').click();
			await expect(dialog(page).getByRole('heading', {name: /New Rate Limit Defaults/i})).toBeVisible();

			// Every limit is still 0. A zero FALLS THROUGH to the next ladder
			// level, so the row asks for nothing and the gateway refuses it 400.
			await expect(dialog(page).getByText(/would constrain nothing/i)).toBeVisible();
			await expect(dialogButton(page, 'Apply')).toBeDisabled();

			//---------------------------------------------------------
			// A rule row, which requires a service
			//---------------------------------------------------------
			await dialog(page).getByRole('combobox', {name: /scope/i}).click();
			await page.getByRole('option', {name: /rule \(one service\)/i}).click();
			await field(page, 'Service').fill(service);
			await field(page, 'User Tokens per Minute').fill('5000');
			await field(page, 'Tenant Requests per Second').fill('7');
			await page.mouse.move(0, 0);
			await expect(dialogButton(page, 'Apply')).toBeEnabled();

			const [createReq] = await Promise.all([
				page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(DEFAULTS_PATH)),
				dialogButton(page, 'Apply').click(),
			]);
			const createBody = createReq.postDataJSON();
			// ⚠️⚠️ ALL SIX LIMIT FIELDS MUST BE ON THE WIRE. The POST replaces the
			// row instead of merging into it, so a body carrying only the two
			// values typed here would be indistinguishable from one that CLEARS
			// the rest — and the gateway answers 204 either way.
			for (const f of ['default_user_rps', 'default_user_tpm', 'default_tenant_rps', 'default_tenant_tpm', 'vip_shared_rps', 'vip_shared_tpm']) {
				expect(createBody, `${f} must be sent even when zero`).toHaveProperty(f);
			}
			expect(createBody).toMatchObject({scope: 'rule', rule_ident: service, default_user_tpm: 5000, default_tenant_rps: 7});
			expect(createBody.isValid).toBeUndefined();
			await expectSuccessAndDismiss(page);

			await expect(defaultsRow(page, service).first()).toBeVisible({timeout: 15_000});

			//---------------------------------------------------------
			// ⭐⭐ THE REGRESSION THIS STAGE EXISTS TO PREVENT: editing one field
			// must not clear the others.
			//---------------------------------------------------------
			await defaultsRow(page, service).first().getByRole('checkbox').check();
			await defaultsToolbar(page, 'Edit').click();
			await expect(dialog(page).getByRole('heading', {name: /Rate Limit Defaults/i})).toBeVisible();
			// The form must open SEEDED from the stored row, or the untouched
			// fields would be posted back as zeros.
			await expect(field(page, 'Tenant Requests per Second')).toHaveValue('7');

			await field(page, 'User Tokens per Minute').fill('9000');
			await page.mouse.move(0, 0);

			const [editReq] = await Promise.all([
				page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(DEFAULTS_PATH)),
				dialogButton(page, 'Apply').click(),
			]);
			// The field the operator never touched must still be on the wire at
			// its stored value. Sending it as 0 — or omitting it — would delete a
			// limit while reporting success.
			expect(editReq.postDataJSON()).toMatchObject({scope: 'rule', rule_ident: service, default_user_tpm: 9000, default_tenant_rps: 7});
			await expectSuccessAndDismiss(page);

			// And the gateway agrees: re-read the row rather than trust the grid.
			const readBack = await gw('GET', `${DEFAULTS_PATH}/rule?rule_ident=${encodeURIComponent(service)}`);
			expect(readBack.ok).toBe(true);
			const stored = await readBack.json();
			expect(stored.default_user_tpm).toBe(9000);
			expect(stored.default_tenant_rps, 'an untouched limit must survive an edit of a different one').toBe(7);

			//---------------------------------------------------------
			// Delete restores fall-through
			//---------------------------------------------------------
			await defaultsRow(page, service).first().getByRole('checkbox').check();
			await defaultsToolbar(page, 'Delete').click();
			const confirm = dialogButton(page, 'Delete');
			if (await confirm.isVisible().catch(() => false)) await confirm.click();
			await expectSuccessAndDismiss(page);

			await expect(defaultsRow(page, service)).toHaveCount(0, {timeout: 15_000});
			const afterDelete = await gw('GET', `${DEFAULTS_PATH}/rule?rule_ident=${encodeURIComponent(service)}`);
			expect(afterDelete.status, 'a deleted row must be gone from the store, not just from the grid').toBe(404);
		} finally {
			// Leave the shared bed as we found it, whatever happened above.
			await gw('DELETE', `${DEFAULTS_PATH}/rule?rule_ident=${encodeURIComponent(service)}`).catch(() => undefined);
		}
	});
});
