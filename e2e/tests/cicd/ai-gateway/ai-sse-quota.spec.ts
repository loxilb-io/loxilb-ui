//---------------------------------------------------------
// cicd source: cicd/ai-sse-quota — AI Gateway SSE connection tuning.
//   fullproxy + model_name + host + path_prefix "/" + path_match_mode=prefix,
//   with sse_mode=true (suppresses idle-timeout during an active stream) and a
//   short max_stream_duration_sec as the absolute stream cap; a companion
//   non-SSE rule (sse_mode omitted) proves the flag is per-rule.
//
// SSE is a config surface — no --userservice, no live SSE stream; we assert
// the tuning serviceArguments round-trip via REST (plan §8).
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

// LB rule 1/3: SSE mode + short stream cap + backend keepalive.
const sse: LbRecipe = {
	cicd: 'cicd/ai-sse-quota',
	name: 'e2e-cicd-ai-sse',
	vip: '203.0.113.102',
	port: '2020',
	mode: 'fullproxy',
	host: '203.0.113.102',
	pathPrefix: '/',
	pathMatchMode: 'prefix',
	ai: {modelName: 'sse-test', sseMode: true, maxStreamDurationSec: '30', backendKeepaliveIntervalSec: '60'},
	endpoints: [{ip: '198.51.100.1', targetPort: '8080'}],
};

// LB rule 2: non-SSE companion (sse_mode omitted).
const nosse: LbRecipe = {
	cicd: 'cicd/ai-sse-quota',
	name: 'e2e-cicd-ai-nosse',
	vip: '203.0.113.103',
	port: '2021',
	mode: 'fullproxy',
	host: '203.0.113.103',
	pathPrefix: '/',
	pathMatchMode: 'prefix',
	ai: {modelName: 'nosse-test'},
	endpoints: [{ip: '198.51.100.2', targetPort: '8080'}],
};

let instName: string;

test.describe('@gw cicd/ai-sse-quota — SSE stream tuning config round-trips', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		for (const r of [sse, nosse]) await cleanupLbByName(r.name);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test('SSE rule: sse_mode + max_stream_duration + keepalive round-trip', async ({page}) => {
		await runLbScenario(page, instName, sse);
	});

	test('non-SSE companion: model rule without sse_mode round-trips', async ({page}) => {
		await runLbScenario(page, instName, nosse);
	});
});
