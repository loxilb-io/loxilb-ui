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
const name = `uc8qa-cli-reset-${Date.now().toString(36)}`;
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

test.describe('UC8-LIVE-CLI-RESET: default values survive a UI edit', () => {
	test.skip(process.env.UC8_QA_ALLOW_MUTATIONS !== '1' || instance !== 'uc8qa-gateway', 'Requires the explicitly authorized dedicated instance.');
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
	test('keeps zero, false and inherit state after changing the UI admission ceiling', async ({page}) => {
		attempted = true;
		execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host, 'docker', 'exec', container,
			'loxicmd', 'create', 'lb', vip, '--tcp=20125:8080', `--endpoints=${backend}:1`, '--mode=fullproxy',
			`--name=${name}`, `--host=${vip}`, '--path-prefix=/', '--path-match-mode=prefix', '--model-name=uc8qa-cli-model', '--sse-mode',
			'--fc-mode=enforce', '--fc-max-outstanding=10', '--fc-max-queue-depth=20', '--fc-max-queue-wait-ms=3000',
			'--fc-wake-policy=inherit', '--fc-band-weights=0:0:0', '--fc-band-min-share-pct=0:0:0',
			'--fc-band-queue-pct=0:0:0', '--fc-band-wait-ms=0:0:0', '--fc-critical-reserve-pct=0',
			'--fc-shed-queue=inherit', '--fc-tenant-wake=inherit', '--fc-llmd-headers=inherit',
			'--ai-default-reservation=inherit', '--ai-default-max-tokens=0', '--ai-objective-strict=false'],
			{encoding: 'utf8', timeout: 25_000, stdio: ['ignore', 'pipe', 'pipe']});
		const before = await readRule();
		for (const key of ['fc_band_weights','fc_band_min_share_pct','fc_band_queue_pct','fc_band_wait_ms']) expect([undefined,'0:0:0'], key).toContain(before[key]);
		for (const key of ['fc_wake_policy','fc_shed_queue','fc_tenant_wake','fc_llmd_headers','ai_default_reservation']) expect([undefined,'inherit'], key).toContain(before[key]);
		expect([undefined,0]).toContain(before.fc_critical_reserve_pct);
		expect([undefined,0]).toContain(before.ai_default_max_tokens);
		expect([undefined,false]).toContain(before.ai_objective_strict);
		await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);
		await selectRowByText(page, name);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		const ai = await expandSection(page, /^AI Gateway/);
		await field(page, 'Max Outstanding', ai).fill('11');
		const [req] = await Promise.all([page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/config/loadbalancer')), dialogButton(page, 'Update').click()]);
		const sent = req.postDataJSON().serviceArguments;
		for (const key of keys) expect(sent[key] === undefined || sent[key] === before[key], `UI must not introduce a new ${key} value`).toBe(true);
		expect((await req.response())?.ok()).toBe(true);
		await expect.poll(async () => (await readRule()).fc_max_outstanding).toBe(11);
		const after = await readRule();
		for (const key of keys) expect(after[key], `stored ${key}`).toEqual(before[key]);
	});
});
