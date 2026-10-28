// UC-8 key priority: live UI create and exact Gateway readback on an owned QA instance.
// This checks stored configuration, not inference admission or scheduling.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, gw} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const instanceName = process.env.E2E_INSTANCE_NAME;
const allowed = process.env.UC8_QA_ALLOW_MUTATIONS === '1' && instanceName === 'uc8qa-gateway';
const sshHost = process.env.UC8_QA_SSH_HOST ?? '';
const gatewayContainer = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const suffix = Date.now().toString(36);
const keyName = `uc8qa-key-${suffix}`;
const tenant = `uc8qa-tenant-${suffix}`;
const objective = `uc8qa-objective-${suffix}`;
let objectiveAttempted = false;
let keyAttempted = false;

// A generated credential is shown once; never retain a trace/screenshot of it.
test.use({trace: 'off', screenshot: 'off', video: 'off'});

test.describe('UC8-LIVE-KEY: key priority fields', () => {
	test.skip(!allowed, 'Requires UC8_QA_ALLOW_MUTATIONS=1 and the dedicated uc8qa-gateway instance.');

	test.beforeAll(async () => {
		expect(sshHost, 'set a safe QA SSH host').toMatch(/^[a-zA-Z0-9._-]+$/);
		expect(gatewayContainer, 'set the owned QA gateway container').toMatch(/^uc8qa-[a-z0-9-]+$/);
		expect((await activeInstance()).name).toBe(instanceName);
		objectiveAttempted = true;
		const response = await gw('POST', '/config/ai/objective', {name: objective, priority: 10});
		expect(response.status).toBe(200);
	});

	test.afterAll(async () => {
		if (keyAttempted) {
			const list = await gw('GET', `/config/ai/apikey?tenant_id=${encodeURIComponent(tenant)}`);
			expect(list.status).toBe(200);
			const rows = await list.json() as {key_id: string; name: string}[];
			for (const row of rows.filter(item => item.name === keyName)) {
				const response = await gw('DELETE', `/config/ai/apikey/${encodeURIComponent(row.key_id)}`);
				expect([200, 204, 404]).toContain(response.status);
			}
		}
		if (objectiveAttempted) {
			const response = await gw('DELETE', `/config/ai/objective/${encodeURIComponent(objective)}`);
			expect([200, 204, 404]).toContain(response.status);
		}
	});

	test('create a priority-bearing key and confirm the stored fields', async ({page}) => {
		await page.goto(`instance/ai/apikey?name=${encodeURIComponent(instanceName!)}`);
		await openToolbarDialog(page, 'Add', dialogTitle(page, 'New AI API Key'));
		await field(page, 'Tenant ID').fill(tenant);
		await field(page, 'Name').fill(keyName);
		await dialog(page).getByRole('button', {name: 'Request Priority'}).click();
		await dialog(page).getByRole('combobox', {name: 'Priority Class'}).click();
		await page.getByRole('option', {name: 'critical', exact: true}).click();
		await field(page, 'Default Objective').fill(objective);
		await field(page, 'Allowed Objectives (comma-separated)').fill(objective);
		keyAttempted = true;
		const [request] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/config/ai/apikey')),
			dialogButton(page, 'Add').click(),
		]);
		expect(request.postDataJSON()).toMatchObject({tenant_id: tenant, name: keyName, priority_class: 'critical', default_objective: objective, allowed_objectives: [objective]});
		const response = await request.response();
		expect(response?.status()).toBe(201);
		const keyId = (await response!.json()).key_id as string;
		expect(keyId).toBeTruthy();
		await expect(dialogTitle(page, 'API Key Created')).toBeVisible();
		await expect(dialog(page).getByText('The gateway reads this key back with the values that were sent.')).toBeVisible();
		await dialogButton(page, 'OK').click();
		const read = await gw('GET', `/config/ai/apikey/${encodeURIComponent(keyId)}`);
		expect(read.status).toBe(200);
		expect(await read.json()).toMatchObject({key_id: keyId, tenant_id: tenant, priority_class: 'critical', default_objective: objective, allowed_objectives: [objective]});
		expect(keyId).toMatch(/^[a-zA-Z0-9_-]+$/);
		const cli = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', sshHost,
			'docker', 'exec', gatewayContainer, 'loxicmd', 'get', 'apikey', keyId, '-o', 'json'],
			{encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe']});
		const cliRows = JSON.parse(cli) as {key_id: string}[];
		expect(Array.isArray(cliRows)).toBe(true);
		expect(cliRows.find(item => item.key_id === keyId)).toMatchObject({key_id: keyId, tenant_id: tenant, priority_class: 'critical', default_objective: objective, allowed_objectives: [objective]});
	});
});
