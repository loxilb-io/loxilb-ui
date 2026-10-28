// UC-8 C5: a CLI-created binding is shown by the read-only UI.
// This validates configuration visibility, not packet attribution/isolation.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, gw} from '../../helpers/api';
import {rowByText, toolbarButton} from '../../helpers/table';

const instanceName = process.env.E2E_INSTANCE_NAME;
const allowed = process.env.UC8_QA_ALLOW_MUTATIONS === '1' && instanceName === 'uc8qa-gateway';
const sshHost = process.env.UC8_QA_SSH_HOST ?? '';
const gatewayContainer = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const suffix = Date.now().toString(36);
const name = `uc8qa-net-${suffix}`;
const tenant = `uc8qa-tenant-${suffix}`;
let attempted = false;

function cli(...args: string[]): string {
	return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', sshHost,
		'docker', 'exec', gatewayContainer, 'loxicmd', ...args],
	{encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe']});
}

test.describe('UC8-LIVE-NETIDENTITY: CLI to UI readback', () => {
	test.skip(!allowed, 'Requires UC8_QA_ALLOW_MUTATIONS=1 and the dedicated uc8qa-gateway instance.');
	test.beforeAll(async () => {
		expect(sshHost).toMatch(/^[a-zA-Z0-9._-]+$/);
		expect(gatewayContainer).toMatch(/^uc8qa-[a-z0-9-]+$/);
		expect((await activeInstance()).name).toBe(instanceName);
		attempted = true;
		cli('create', 'netidentity', name, `--tenant=${tenant}`, '--cidr=192.0.2.0/24');
	});
	test.afterAll(async () => {
		if (!attempted) return;
		const list = JSON.parse(cli('get', 'netidentity', '-o', 'json')) as {netIdentityAttr?: {name: string}[]};
		if (list.netIdentityAttr?.some(item => item.name === name)) cli('delete', 'netidentity', name);
		const after = JSON.parse(cli('get', 'netidentity', '-o', 'json')) as {netIdentityAttr?: {name: string}[]};
		expect(after.netIdentityAttr?.some(item => item.name === name) ?? false).toBe(false);
	});
	test('shows the CLI binding and offers no mutation controls', async ({page}) => {
		const response = await gw('GET', '/config/ai/netidentity');
		expect(response.status).toBe(200);
		const body = await response.json() as {netIdentityAttr?: {name: string; tenant: string; match: {cidr: string[]}}[]};
		expect(body.netIdentityAttr?.find(item => item.name === name)).toMatchObject({name, tenant, match: {cidr: ['192.0.2.0/24']}});
		await page.goto(`instance/ai/netidentity?name=${encodeURIComponent(instanceName!)}`);
		const row = rowByText(page, name).first();
		await expect(row).toBeVisible();
		await expect(row).toContainText(tenant);
		await expect(row).toContainText('192.0.2.0/24');
		for (const action of ['Add', 'Edit', 'Delete'] as const) await expect(toolbarButton(page, action)).toHaveCount(0);
	});
});
