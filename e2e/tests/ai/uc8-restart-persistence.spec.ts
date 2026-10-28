// Live CLI-only field preservation across an unrelated UI edit.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, fullproxyVip, gw} from '../../helpers/api';
import {dialogButton, openToolbarDialog} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {selectRowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';

const instance = process.env.E2E_INSTANCE_NAME;
const host = process.env.UC8_QA_SSH_HOST ?? '';
const container = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const backend = process.env.UC8_QA_BACKEND_IP ?? '';
const vip = fullproxyVip();
const name = `uc8qa-restart-${Date.now().toString(36)}`;
const keys = ['fc_wake_policy', 'fc_band_weights', 'fc_band_min_share_pct', 'fc_band_queue_pct', 'fc_band_wait_ms', 'fc_critical_reserve_pct', 'fc_shed_queue', 'fc_tenant_wake', 'fc_llmd_headers', 'ai_default_reservation', 'ai_default_max_tokens', 'ai_objective_strict'] as const;
let attempted = false;
async function readRule(): Promise<Record<string, any>> {
	const r = await gw('GET', '/config/loadbalancer/all');
	expect(r.status).toBe(200);
	const body = await r.json() as {lbAttr?: {serviceArguments: Record<string, any>}[]};
	const row = body.lbAttr?.find(item => item.serviceArguments.name === name);
	expect(row, 'the owned rule must be present').toBeTruthy();
	return row!.serviceArguments;
}

test.describe('UC8-LIVE-RESTART: persisted expert settings', () => {
	test.skip(process.env.UC8_QA_ALLOW_RESTART !== '1' || process.env.UC8_QA_ALLOW_MUTATIONS !== '1' || instance !== 'uc8qa-gateway', 'Requires the explicitly authorized dedicated instance.');
	test.beforeAll(async () => {
		expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);
		expect(container).toMatch(/^uc8qa-[a-z0-9-]+$/);
		expect(backend).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
		expect(vip).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
		expect((await activeInstance()).name).toBe(instance);
	});
	test.afterAll(async () => {
		if (!attempted) return;
		await cleanupLbByName(name);
		const r = await gw('GET', '/config/loadbalancer/all');
		expect(r.status).toBe(200);
		const body = await r.json() as {lbAttr?: {serviceArguments: {name: string}}[]};
		expect((body.lbAttr ?? []).some(row => row.serviceArguments.name === name)).toBe(false);
	});
	test('persists UI-edited and CLI-only settings across a gateway restart', async ({page}) => {
		test.setTimeout(180_000);
		expect(container).toBe('uc8qa-20261028-gateway');
		attempted = true;
		execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host, 'docker', 'exec', container,
			'loxicmd', 'create', 'lb', vip, '--tcp=20129:8080', `--endpoints=${backend}:1`, '--mode=fullproxy',
			`--name=${name}`, `--host=${vip}`, '--path-prefix=/', '--path-match-mode=prefix', '--model-name=uc8qa-cli-model', '--sse-mode',
			'--fc-mode=enforce', '--fc-max-outstanding=10', '--fc-max-queue-depth=20', '--fc-max-queue-wait-ms=3000',
			'--fc-wake-policy=weighted', '--fc-band-weights=8:3:1', '--fc-band-min-share-pct=10:10:10',
			'--fc-band-queue-pct=30:30:30', '--fc-band-wait-ms=1000:2000:3000', '--fc-critical-reserve-pct=10',
			'--fc-shed-queue=on', '--fc-tenant-wake=rr', '--fc-llmd-headers=on',
			'--ai-default-reservation=on', '--ai-default-max-tokens=128', '--ai-objective-strict=true'],
			{encoding: 'utf8', timeout: 25_000, stdio: ['ignore', 'pipe', 'pipe']});
		const before = await readRule();
		expect(before).toMatchObject({fc_wake_policy: 'weighted', fc_band_weights: '8:3:1',
			fc_band_min_share_pct: '10:10:10', fc_band_queue_pct: '30:30:30', fc_band_wait_ms: '1000:2000:3000',
			fc_critical_reserve_pct: 10, fc_shed_queue: 'on', fc_tenant_wake: 'rr', fc_llmd_headers: 'on',
			ai_default_reservation: 'on', ai_default_max_tokens: 128, ai_objective_strict: true});
		for (const key of keys) expect(before[key], `CLI created ${key}`).not.toBeUndefined();
		await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);
		await selectRowByText(page, name);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		const ai = await expandSection(page, /^AI Gateway/);
		await field(page, 'Max Outstanding', ai).fill('11');
		const [req] = await Promise.all([page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/config/loadbalancer')), dialogButton(page, 'Update').click()]);
		const sent = req.postDataJSON().serviceArguments;
		for (const key of keys) expect(sent[key], `UI preserves ${key} in the write`).toEqual(before[key]);
		expect((await req.response())?.ok()).toBe(true);
		await expect.poll(async () => (await readRule()).fc_max_outstanding).toBe(11);
		const after = await readRule();
		for (const key of keys) expect(after[key], `stored ${key}`).toEqual(before[key]);
		const persisted=await gw('POST','/config/persist',{});
		expect(persisted.status,'explicitly persist the owned test configuration').toBe(200);
		execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','restart',container],{encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe']});
		await expect.poll(async()=>{
			try { const r=await gw('GET','/status/ready');return r.status===200; } catch { return false; }
		},{timeout:90_000,intervals:[1000,2000,3000]}).toBe(true);
		const reloaded=await readRule();
		expect(reloaded.fc_max_outstanding).toBe(11);
		for(const key of keys)expect(reloaded[key],`after restart ${key}`).toEqual(after[key]);
		await page.reload();
		const refresh=page.getByRole('button',{name:/Refresh/i}).first();
		await expect(refresh).toBeVisible();await refresh.click();
		await selectRowByText(page,name);
		await openToolbarDialog(page,'Edit','Edit Load Balancer Rule');
		const restoredAI=await expandSection(page,/^AI Gateway/);
		await expect(field(page,'Max Outstanding',restoredAI)).toHaveValue('11');
	});
});
