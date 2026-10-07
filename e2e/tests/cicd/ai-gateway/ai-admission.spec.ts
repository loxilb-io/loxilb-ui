//---------------------------------------------------------
// Capacity admission control (fc_*) on an AI rule — live gateway round-trip
// (ADM-E2E-07/08).
//   An SSE AI rule created through the UI with declared admission values, and a
//   companion with the group untouched. The declared rule must come back with
//   those values AND with `fc_effective` saying the rule is what set them; the
//   companion must come back with no declared fc_* and nothing credited to the
//   rule, which is what proves "blank = omitted" end to end (a UI that sent a
//   blank as 0 would store a declaration, and the gateway would say `rule`).
//
// ⚠️ Needs a gateway that declares per-rule admission (gateway fe6a8ba1 or
// later). An older one answers 200 and drops what it does not know, so the
// spec asks the instance's own /meta first and skips, with the reason, rather
// than asserting against a gateway that cannot store the fields.
//---------------------------------------------------------
import {expect, test} from '../../../fixtures';
import {fullproxyVip, activeInstance, gwJson, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {rowByText} from '../../../helpers/table';
import {cleanupLbByName, LB_PATH, LbRecipe, runLbScenario} from '../_recipes';

// A fullproxy rule is a listener the gateway binds, so its VIP is an address
// of the gateway (helpers/api.ts, fullproxyVip).
const FP_VIP = fullproxyVip();

const LB_ALL = `${LB_PATH}/all`;

const declared: LbRecipe = {
	cicd: 'cicd/ai-admission',
	name: 'e2e-cicd-ai-adm',
	vip: FP_VIP,
	port: '20110',
	mode: 'fullproxy',
	host: FP_VIP,
	pathPrefix: '/',
	pathMatchMode: 'prefix',
	ai: {modelName: 'adm-test', sseMode: true, fcMode: 'observe', fcMaxOutstanding: '64', fcMaxQueueDepth: '8', fcMaxQueueWaitMs: '2000'},
	endpoints: [{ip: '198.51.100.10', targetPort: '8080'}],
};

const untouched: LbRecipe = {
	cicd: 'cicd/ai-admission',
	name: 'e2e-cicd-ai-adm-default',
	vip: FP_VIP,
	port: '20111',
	mode: 'fullproxy',
	host: FP_VIP,
	pathPrefix: '/',
	pathMatchMode: 'prefix',
	ai: {modelName: 'adm-default', sseMode: true},
	endpoints: [{ip: '198.51.100.11', targetPort: '8080'}],
};

/** The rule's read-back, which must exist — a missing rule is a failure, never a skip. */
async function readBack(name: string): Promise<Record<string, any>> {
	const data = await gwJson<{lbAttr?: any[]}>(LB_ALL);
	const rule = (data.lbAttr ?? []).find(x => x.serviceArguments?.name === name);
	expect(rule, `rule ${name} present in gateway read-back`).toBeTruthy();
	return rule.serviceArguments;
}

// What the declared recipe sets; every one must be declared for the spec to mean anything.
const NEEDED = ['fc_mode', 'fc_max_outstanding', 'fc_max_queue_depth', 'fc_max_queue_wait_ms', 'fc_effective'];

/** The needed admission fields this gateway's /meta does not declare. */
async function undeclaredAdmission(): Promise<string[]> {
	const meta = await gwJson<Record<string, any>>('/meta');
	const sa = meta['/config/loadbalancer']?.fields?.serviceArguments;
	expect(sa, '/meta declares the LB serviceArguments').toBeTruthy();
	return NEEDED.filter(key => sa[key] === undefined);
}

let instName: string;
let missing: string[];

test.describe('@gw cicd/ai-admission — admission control round-trips', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		missing = await undeclaredAdmission();
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.beforeEach(() => {
		test.skip(missing.length > 0, `gateway predates per-rule admission (needs fe6a8ba1+); /meta lacks ${missing.join(', ')}`);
	});

	test.afterEach(async () => {
		for (const r of [declared, untouched]) await cleanupLbByName(r.name);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test('ADM-E2E-07: declared admission values are stored and credited to the rule', async ({page}) => {
		await runLbScenario(page, instName, declared);

		const sa = await readBack(declared.name);
		const eff = sa.fc_effective;
		expect(eff, 'an SSE AI rule reports fc_effective').toBeTruthy();
		expect(eff.mode).toBe('observe');
		expect(eff.max_outstanding).toBe(64);
		expect(eff.queue_depth).toBe(8);
		expect(eff.queue_wait_ms).toBe(2000);
		expect(eff.source).toMatchObject({mode: 'rule', max_outstanding: 'rule', queue_depth: 'rule'});

		// The detail panel shows the same thing the gateway said.
		await rowByText(page, declared.name).click();
		await page.getByRole('tab', {name: 'AI Gateway'}).click();
		await expect(page.getByText('observe (rule)')).toBeVisible();
		await expect(page.getByText('8 / 2000 ms (rule)')).toBeVisible();
	});

	test('ADM-E2E-08: an untouched group declares nothing, and nothing is credited to the rule', async ({page}) => {
		let body: any;
		page.on('request', rq => {
			if (rq.method() === 'POST' && rq.url().endsWith('/config/loadbalancer')) body = rq.postDataJSON();
		});
		await runLbScenario(page, instName, untouched);
		expect(body, 'the create POST was observed').toBeTruthy();
		expect(Object.keys(body.serviceArguments).filter(k => k.startsWith('fc_'))).toEqual([]);

		const sa = await readBack(untouched.name);
		const declaredKeys = Object.keys(sa).filter(k => k.startsWith('fc_') && k !== 'fc_effective');
		expect(declaredKeys, 'no fc_* declaration stored').toEqual([]);
		const eff = sa.fc_effective;
		expect(eff, 'an SSE AI rule reports fc_effective').toBeTruthy();
		const sources = Object.entries(eff.source ?? {});
		// The read must have landed with sources in it, or "none is rule" proves nothing.
		expect(sources.length, 'fc_effective.source is populated').toBeGreaterThan(0);
		for (const [key, src] of sources) {
			expect(['env', 'default'], `source.${key}`).toContain(src);
		}
	});
});
