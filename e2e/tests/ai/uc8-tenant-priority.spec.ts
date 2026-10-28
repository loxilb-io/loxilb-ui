// Dedicated QA only: tenant priority UI write and Gateway/CLI readback.
// The API has no DELETE; cleanup neutralizes the owned tenant row.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, RATELIMIT_DEFAULTS_ABSENT} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const instance = process.env.E2E_INSTANCE_NAME;
const host = process.env.UC8_QA_SSH_HOST ?? '';
const container = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const tenant = `uc8qa-tenant-${Date.now().toString(36)}`;
const objective = `uc8qa-obj-${Date.now().toString(36)}`;
const path = '/config/ai/tenant/ratelimit';
let objectiveAttempted = false;
let tenantAttempted = false;

test.describe('UC8-LIVE-TENANT: tenant priority fields', () => {
	test.skip(process.env.UC8_QA_ALLOW_MUTATIONS !== '1' || instance !== 'uc8qa-gateway', 'Requires the explicitly authorized dedicated instance.');
	test.beforeAll(async () => {
		expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);
		expect(container).toMatch(/^uc8qa-[a-z0-9-]+$/);
		expect((await activeInstance()).name).toBe(instance);
		objectiveAttempted = true;
		expect((await gw('POST', '/config/ai/objective', {name: objective, priority: 10})).status).toBe(200);
	});
	test.afterAll(async () => {
		if (tenantAttempted) {
			const r = await gw('POST', path, {tenant_id: tenant, rps: 0, tokens_per_min: 0, burst_pct: 0, priority_class: 'standard', default_objective: '', allowed_objectives: []});
			expect(r.ok, 'neutralize the owned tenant; Gateway has no delete').toBe(true);
		}
		if (objectiveAttempted) expect([200, 204, 404]).toContain((await gw('DELETE', `/config/ai/objective/${objective}`)).status);
	});
	test('writes tenant priority, default and allowlist', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest(RATELIMIT_DEFAULTS_ABSENT);
		await page.goto(`instance/ai/ratelimit?name=${encodeURIComponent(instance!)}`);
		await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI Tenant Rate Limit'}), {table: 'AI Tenant Rate Limits'});
		await field(page, 'Tenant ID').fill(tenant);
		await dialog(page).getByRole('button', {name: 'Request Priority'}).click();
		await dialog(page).getByRole('combobox', {name: 'Priority Class'}).click();
		await page.getByRole('option', {name: 'critical', exact: true}).click();
		await field(page, 'Default Objective').fill(objective);
		await field(page, 'Allowed Objectives (comma-separated)').fill(objective);
		tenantAttempted = true;
		const [req] = await Promise.all([page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(path)), dialogButton(page, 'Apply').click()]);
		expect(req.postDataJSON()).toMatchObject({tenant_id: tenant, priority_class: 'critical', default_objective: objective, allowed_objectives: [objective]});
		await expectSuccessAndDismiss(page);
		const response = await gw('GET', `${path}/${tenant}`);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({tenant_id: tenant, priority_class: 'critical', default_objective: objective, allowed_objectives: [objective]});
		const raw = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host, 'docker', 'exec', container, 'loxicmd', 'get', 'ratelimit', tenant, '-o', 'json'], {encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe']});
		expect(JSON.parse(raw)).toMatchObject({tenant_id: tenant, priority_class: 'critical', default_objective: objective, allowed_objectives: [objective]});
	});
});
