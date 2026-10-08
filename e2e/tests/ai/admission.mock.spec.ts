//---------------------------------------------------------
// Capacity admission control (fc_*) on AI rules — mock contract layer
// (ADM-E2E-01..06, 09).
//---------------------------------------------------------
// Admission fields are written by a POST of the whole rule: the gateway's LB
// PATCH does not apply them and does not reach fullproxy rules at all. So the
// form sets them on create, an edit of an existing AI rule sends the whole rule
// again (the gateway applies an admission-only change to the running listener),
// and the read-back shows what is in force.
//
// ⭐ Only the rule list, the LB writes and the admission part of `/meta` are
// intercepted. `/version` and the rest of `/meta` stay real, so the flavor gate
// that exposes the AI fields is exercised; the capability read is fixed to
// "ready" so the spec does not inherit the testbed's KV-exact deployment state
// (helpers/capabilities.ts). The form offers only the fc_* fields the
// instance's own /meta declares, so the declarations are set per test rather
// than inherited from whichever gateway build the testbed runs.
import type {Page, Request, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {mockKvExactReady} from '../../helpers/capabilities';
import {dialog, dialogButton, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {rowByText, selectRowByText} from '../../helpers/table';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
// Every LB write: create (POST /config/loadbalancer), the tuple PATCH, deletes.
const LB_WRITE_RE = /\/netlox\/v1\/config\/loadbalancer(\/(?!all)[^?]*)?(\?.*)?$/;

const META_RE = /\/netlox\/v1\/meta(\?.*)?$/;

// Writable admission fields as the current gateway declares them (the unit
// contract test pins the UI's list against api-spec/gateway-swagger.yml).
const FC_DECLARED = [
	'fc_mode', 'fc_adaptive', 'fc_max_outstanding', 'fc_ep_max_inflight', 'fc_prefill_max_inflight',
	'fc_decode_max_inflight', 'fc_max_queue_depth', 'fc_max_queue_wait_ms', 'fc_telemetry_stale_ms',
	'fc_warmup_ms', 'fc_ttft_target_ms', 'fc_tenant_max_share_pct',
];

/** Serve the real /meta with exactly `declared` as the rule's admission fields. */
async function declareAdmission(page: Page, declared: readonly string[] = FC_DECLARED): Promise<void> {
	await page.route(META_RE, async (route: Route) => {
		const resp = await route.fetch();
		const meta = await resp.json();
		const sa = meta['/config/loadbalancer']?.fields?.serviceArguments;
		if (!sa) throw new Error('/meta has no /config/loadbalancer serviceArguments — the fixture no longer matches the gateway');
		// Every admission field the gateway declares goes, not only the ones
		// listed here: a newer gateway declares more, and one left behind keeps
		// the group on screen in the case that says there is none.
		for (const key of Object.keys(sa)) if (key.startsWith('fc_')) delete sa[key];
		for (const key of declared) {
			sa[key] = key === 'fc_mode' || key === 'fc_adaptive'
				? {type: 'string', required: false}
				: {type: 'integer', format: 'int32', required: false};
		}
		await route.fulfill({response: resp, json: meta});
	});
}

const AI_RULE = 'e2e-adm-ai';
const L4_RULE = 'e2e-adm-l4';

let instName: string;

/** An existing SSE AI rule whose read-back declares admission fields and carries the resolved state. */
function aiRule(over: Record<string, unknown> = {}) {
	return {
		serviceArguments: {
			name: AI_RULE, externalIP: '192.0.2.91', port: 18091, protocol: 'tcp', sel: 0, mode: 4,
			sse_mode: true, model_name: 'adm-model',
			fc_mode: 'observe', fc_max_outstanding: 64, fc_max_queue_depth: 8, fc_max_queue_wait_ms: 2000,
			fc_effective: {
				mode: 'observe', max_outstanding: 64, effective_max_outstanding: 64, queue_depth: 8, queue_wait_ms: 2000,
				inflight: 3, queued: 0, adaptive: 'off', adapt_state: 'off',
				source: {mode: 'rule', max_outstanding: 'rule', queue_depth: 'rule'},
			},
			...over,
		},
		endpoints: [{endpointIP: '198.51.100.91', targetPort: 18091, weight: 1, state: 'active'}],
		secondaryIPs: null,
		allowedSources: null,
	};
}

async function mockRuleList(page: Page, rules: unknown[]): Promise<void> {
	await page.route(LB_ALL_RE, (route: Route) =>
		route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: rules})}),
	);
}

/** Records every LB write; answers each with `status` (a create gets the success envelope). */
async function recordWrites(page: Page, status = 200, body: unknown = {code: 200, result: 'Success'}): Promise<Request[]> {
	const writes: Request[] = [];
	await page.route(LB_WRITE_RE, (route: Route) => {
		writes.push(route.request());
		return route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
	});
	return writes;
}

/** Open Add and fill a minimal fullproxy rule; returns the AI Gateway section. */
async function openAddFullproxy(page: Page) {
	await page.goto(`instance/traffic/lb?name=${instName}`);
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	await field(page, 'Rule Name').fill('e2e-adm-new');
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.92');
	await field(page, 'Port Min').fill('18092');
	await expandSection(page, /^Advanced Settings/);
	await selectOption(page, 'Mode', 'fullproxy');
	const eps = await expandSection(page, /^Endpoints$/);
	await eps.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', eps).first().fill('198.51.100.92');
	await field(page, 'Target Port', eps).first().fill('18092');
	return expandSection(page, /^AI Gateway/);
}

async function openAdmission(aigw: ReturnType<typeof dialog>) {
	const toggle = aigw.getByRole('button', {name: 'Admission Control'});
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

test.describe('@gw AI admission control — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await mockKvExactReady(page);
		await declareAdmission(page);
	});

	test('ADM-E2E-01: the group appears only for an AI service, and P/D-only fields only on P/D', async ({page}) => {
		await mockRuleList(page, []);
		const aigw = await openAddFullproxy(page);
		const toggle = aigw.getByRole('button', {name: 'Admission Control'});
		// fullproxy alone has no admission pool.
		await expect(toggle).toHaveCount(0);
		await field(page, 'SSE Mode', aigw).check();
		await expect(toggle).toBeVisible();
		await openAdmission(aigw);
		await expect(field(page, 'Max Outstanding', aigw)).toBeVisible();
		await expect(field(page, 'Prefill Max Inflight', aigw)).toHaveCount(0);
		await selectOption(page, 'Topology', 'P/D disaggregation');
		await expect(field(page, 'Prefill Max Inflight', aigw)).toBeVisible();
		await expect(field(page, 'Telemetry Stale (ms)', aigw)).toBeVisible();
		await selectOption(page, 'Topology', 'Plain routing');
		await field(page, 'SSE Mode', aigw).uncheck();
		await expect(toggle).toHaveCount(0);
		// An L4 mode never shows it.
		await field(page, 'SSE Mode', aigw).check();
		await selectOption(page, 'Mode', 'dnat');
		await expect(toggle).toHaveCount(0);
	});

	test('ADM-E2E-02: untouched sends no fc_*; declared values go exactly; a typed 0 is sent as 0', async ({page}) => {
		await mockRuleList(page, []);
		const writes = await recordWrites(page);
		const aigw = await openAddFullproxy(page);
		await field(page, 'SSE Mode', aigw).check();
		await dialogButton(page, 'Create').click();
		await expect.poll(() => writes.length).toBe(1);
		const untouched = writes[0].postDataJSON().serviceArguments;
		expect(Object.keys(untouched).filter(key => key.startsWith('fc_'))).toEqual([]);

		writes.length = 0;
		const aigw2 = await openAddFullproxy(page);
		await field(page, 'SSE Mode', aigw2).check();
		await openAdmission(aigw2);
		await selectOption(page, 'Admission Mode', 'observe');
		await field(page, 'Max Outstanding', aigw2).fill('64');
		await field(page, 'Queue Depth', aigw2).fill('8');
		await field(page, 'Queue Wait (ms)', aigw2).fill('2000');
		await field(page, 'Endpoint Warm-up (ms)', aigw2).fill('0');
		await dialogButton(page, 'Create').click();
		await expect.poll(() => writes.length).toBe(1);
		const sa = writes[0].postDataJSON().serviceArguments;
		expect(Object.fromEntries(Object.entries(sa).filter(([key]) => key.startsWith('fc_')))).toEqual({
			fc_mode: 'observe', fc_max_outstanding: 64, fc_max_queue_depth: 8, fc_max_queue_wait_ms: 2000, fc_warmup_ms: 0,
		});
	});

	test('ADM-E2E-03: out-of-range and unpaired values block submit with the reason, and nothing is sent', async ({page}) => {
		await mockRuleList(page, []);
		const writes = await recordWrites(page);
		const aigw = await openAddFullproxy(page);
		await field(page, 'SSE Mode', aigw).check();
		await openAdmission(aigw);
		await field(page, 'Max Outstanding', aigw).fill('100001');
		await expect(aigw.getByText('Must be at most 100000.')).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();
		await field(page, 'Max Outstanding', aigw).fill('64');
		await field(page, 'Queue Depth', aigw).fill('8');
		await expect(dialog(page).getByText('A queue depth needs a queue wait greater than 0 ms.')).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();
		await field(page, 'Queue Wait (ms)', aigw).fill('2000');
		await expect(dialogButton(page, 'Create')).toBeEnabled();
		expect(writes).toHaveLength(0);
	});

	// One rule per page load: selecting a second row re-mounts the detail pane on
	// its first tab, so a multi-row walk tests the tab strip, not the read-back.
	async function openAIDetail(page: Page, rule: ReturnType<typeof aiRule>): Promise<void> {
		await page.unroute(LB_ALL_RE);
		await mockRuleList(page, [rule]);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await rowByText(page, rule.serviceArguments.name as string).click();
		await page.getByRole('tab', {name: 'AI Gateway'}).click();
	}

	test('ADM-E2E-04: the rule detail shows what is in force and who set it, and warns when held', async ({page}) => {
		await openAIDetail(page, aiRule());
		await expect(page.getByText('observe (rule)')).toBeVisible();
		await expect(page.getByText('8 / 2000 ms (rule)')).toBeVisible();
		await expect(page.getByText(/adaptive ceiling is/)).toHaveCount(0);

		await openAIDetail(page, aiRule({
			name: 'e2e-adm-held', port: 18093,
			fc_effective: {...aiRule().serviceArguments.fc_effective, adaptive: 'on', adapt_state: 'tightened', adapt_reason: 'ttft', effective_max_outstanding: 40},
		}));
		await expect(page.getByText('The adaptive ceiling is tightened at 40 of 64 (reason: ttft).')).toBeVisible();

		await openAIDetail(page, aiRule({name: 'e2e-adm-unreported', port: 18094, fc_effective: undefined}));
		await expect(page.getByText('Not reported by this gateway.')).toBeVisible();
		await expect(page.getByText(/^off\b/)).toHaveCount(0);
	});

	test('ADM-E2E-11: the detail shows what the pool holds now, reads a member the gateway left out as zero, and says when it was read', async ({page}) => {
		// As the gateway serializes it: a zero is left out. An unlimited
		// ceiling, a pool with no queue and an idle pool carry no member at all.
		await openAIDetail(page, aiRule({
			fc_effective: {mode: 'enforce', adaptive: 'off', adapt_state: 'off', source: {mode: 'env', max_outstanding: 'default', queue_depth: 'default', ep_max_inflight: 'default'}},
		}));
		const valueOf = (label: string) => page.getByText(label, {exact: true}).locator('xpath=ancestor::div[contains(@class,"MuiStack-root")][1]').locator('p');
		await expect(valueOf('Ceiling in Force')).toHaveText('Unlimited (default)');
		await expect(valueOf('Endpoint Ceiling')).toHaveText('Unlimited (default)');
		await expect(valueOf('Queue (depth / wait)')).toHaveText('None (over the ceiling is refused) (default)');
		await expect(valueOf('Executing Now')).toHaveText('0');
		await expect(valueOf('Waiting Now')).toHaveText('0');
		await expect(page.getByText(/Executing and waiting are as read at .+ and move with traffic/)).toBeVisible();
	});

	test('ADM-E2E-12: on an existing rule a mode returned to the gateway default is sent as inherit, and a blanked number is no change', async ({page}) => {
		await mockRuleList(page, [aiRule()]);
		const writes = await recordWrites(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await selectRowByText(page, AI_RULE);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		let aigw = await expandSection(page, /^AI Gateway/);
		await expect(aigw.getByText(/a blank number is not sent and the rule keeps the value it has/)).toBeVisible();
		await expect(aigw.getByText(/cannot be changed in place/)).toHaveCount(0);

		// A blank alone asks for nothing the gateway would do.
		await field(page, 'Max Outstanding', aigw).fill('');
		await dialogButton(page, 'Update').click();
		await expect(page.getByText('No changes to apply.')).toBeVisible({timeout: 20_000});
		expect(writes).toHaveLength(0);
		await dialogButton(page, 'OK').click();

		await selectRowByText(page, AI_RULE);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		aigw = await expandSection(page, /^AI Gateway/);
		await selectOption(page, 'Admission Mode', 'Gateway default');
		await dialogButton(page, 'Update').click();
		await expect.poll(() => writes.length, {timeout: 20_000}).toBe(1);
		const body = writes[0].postDataJSON();
		// An omission would leave `observe` stored.
		expect(body.serviceArguments.fc_mode).toBe('inherit');
		expect(body.serviceArguments.fc_max_outstanding).toBe(64);
	});

	test('ADM-E2E-05: an admission change on an existing AI rule is sent as a whole-rule POST, without the read-back counters', async ({page}) => {
		await mockRuleList(page, [aiRule()]);
		const writes = await recordWrites(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await selectRowByText(page, AI_RULE);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		const aigw = await expandSection(page, /^AI Gateway/);
		// Declared fields open the group and show the stored values.
		await expect(field(page, 'Max Outstanding', aigw)).toHaveValue('64');
		await field(page, 'Max Outstanding', aigw).fill('32');
		await dialogButton(page, 'Update').click();
		await expect.poll(() => writes.length, {timeout: 20_000}).toBe(1);
		// The POST, never the tuple PATCH — the gateway refuses that on mode 4.
		expect(writes[0].method()).toBe('POST');
		const body = writes[0].postDataJSON();
		expect(body.serviceArguments).toMatchObject({name: AI_RULE, model_name: 'adm-model', fc_mode: 'observe', fc_max_outstanding: 32, fc_max_queue_depth: 8});
		// fc_effective is a read-back of live counters, never an operator change.
		expect(body.serviceArguments).not.toHaveProperty('fc_effective');
		// An admission-only change is applied to the running listener, so
		// there is no re-creation to ask about.
		await expect(page.getByText(/builds its endpoint pool again/)).toHaveCount(0);
	});

	test('ADM-E2E-06: a gateway 400 on the admission fields is an invalid request, not a precondition', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 400, path: /\/config\/loadbalancer$/});
		await mockRuleList(page, []);
		const writes = await recordWrites(page, 400, {code: 400, message: 'Malformed arguments for API call', result: 'fc_max_queue_wait_ms must be greater than 0 when fc_max_queue_depth is set', fields: ['fc_max_queue_wait_ms']});
		const aigw = await openAddFullproxy(page);
		await field(page, 'SSE Mode', aigw).check();
		await openAdmission(aigw);
		await field(page, 'Max Outstanding', aigw).fill('64');
		await dialogButton(page, 'Create').click();
		await expect(page.getByText('The request was rejected as invalid.')).toBeVisible({timeout: 20_000});
		await expect(page.getByText(/its deployment must change/)).toHaveCount(0);
		await expect(page.getByRole('button', {name: 'Retry'})).toHaveCount(0);
		expect(writes).toHaveLength(1);
	});

	// The key-changed "create" edit (selectLBEditStrategy → create) is a code
	// path only: the edit dialog locks every key field, so an operator cannot
	// reach it. Pin the lock, so a future unlock is a conscious change that must
	// also bring the create path's fc_effective strip under E2E.
	test('ADM-E2E-09: the edit dialog locks the rule key, so an AI rule edit can never become a create', async ({page}) => {
		await mockRuleList(page, [aiRule()]);
		const writes = await recordWrites(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await selectRowByText(page, AI_RULE);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		await expandSection(page, /^Basic Settings/);
		for (const label of ['Rule Name', 'External IP', 'Port Min', 'Port Max']) {
			await expect(field(page, label)).toBeDisabled();
		}
		await expect(field(page, 'Protocol')).toBeDisabled();
		expect(writes).toHaveLength(0);
	});

	test('ADM-E2E-01b: an L4 rule never shows the group, even with a credential policy', async ({page}) => {
		await mockRuleList(page, [{
			serviceArguments: {name: L4_RULE, externalIP: '192.0.2.96', port: 18096, protocol: 'tcp', sel: 0, mode: 0},
			endpoints: [{endpointIP: '198.51.100.96', targetPort: 18096, weight: 1, state: 'active'}],
		}]);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await selectRowByText(page, L4_RULE);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		const aigw = await expandSection(page, /^AI Gateway/);
		await expect(aigw.getByRole('button', {name: 'Admission Control'})).toHaveCount(0);
	});
	// Seen live: a gateway build that knew only the queue pair answered 200 to a
	// create carrying fc_mode and fc_max_outstanding, stored the pair and
	// dropped the rest. Offering a field that gateway does not declare is a
	// "saved" setting with no effect and no error.
	test('ADM-E2E-10: only the fields this gateway declares are offered', async ({page}) => {
		await page.unroute(META_RE);
		await declareAdmission(page, ['fc_max_queue_depth', 'fc_max_queue_wait_ms']);
		await mockRuleList(page, []);
		const writes = await recordWrites(page);
		const aigw = await openAddFullproxy(page);
		await field(page, 'SSE Mode', aigw).check();
		await openAdmission(aigw);
		await expect(field(page, 'Queue Depth', aigw)).toBeVisible();
		await expect(field(page, 'Queue Wait (ms)', aigw)).toBeVisible();
		await expect(field(page, 'Max Outstanding', aigw)).toHaveCount(0);
		await expect(field(page, 'Admission Mode', aigw)).toHaveCount(0);
		await field(page, 'Queue Depth', aigw).fill('8');
		await field(page, 'Queue Wait (ms)', aigw).fill('2000');
		await dialogButton(page, 'Create').click();
		await expect.poll(() => writes.length).toBe(1);
		const sa = writes[0].postDataJSON().serviceArguments;
		expect(Object.keys(sa).filter(key => key.startsWith('fc_')).sort()).toEqual(['fc_max_queue_depth', 'fc_max_queue_wait_ms']);
	});

	// A fresh page: /meta is cached for the session, and a gateway's declarations
	// only change across an upgrade anyway.
	test('ADM-E2E-10b: a gateway older than admission control shows no group at all', async ({page}) => {
		await page.unroute(META_RE);
		await declareAdmission(page, []);
		await mockRuleList(page, []);
		const aigw2 = await openAddFullproxy(page);
		await field(page, 'SSE Mode', aigw2).check();
		await expect(field(page, 'Model Name', aigw2)).toBeVisible();
		await expect(aigw2.getByRole('button', {name: 'Admission Control'})).toHaveCount(0);
	});
});
