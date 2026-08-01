//---------------------------------------------------------
// cicd source: cicd/vllm-pd-disagg (port 2023 rule) — prefill/decode
// disaggregation with cache-aware routing.
//   fullproxy + security=https + host + pd_disagg_mode + pd_cache_aware_mode +
//   sse_mode, four endpoints split prefill/decode with distinct NIXL side-
//   channel ports (the KV-transfer ports the P/D orchestration uses).
//
// Config surface (plan §8): assert the P/D serviceArguments and the per-
// endpoint ep_role + nixl_port round-trip via REST (both echoed by the gateway
// — verified live). No mock vLLM, no live prefill/decode traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/vllm-pd-disagg',
	name: 'e2e-cicd-ai-pd',
	vip: '203.0.113.109',
	port: '2020',
	mode: 'fullproxy',
	security: 'https',
	host: '203.0.113.109',
	ai: {pdDisaggMode: true, pdCacheAwareMode: true, sseMode: true},
	endpoints: [
		{ip: '198.51.100.61', targetPort: '8000', epRole: 'prefill', nixlPort: '9001'},
		{ip: '198.51.100.63', targetPort: '8000', epRole: 'prefill', nixlPort: '9003'},
		{ip: '198.51.100.62', targetPort: '8000', epRole: 'decode', nixlPort: '9002'},
		{ip: '198.51.100.64', targetPort: '8000', epRole: 'decode', nixlPort: '9004'},
	],
};

let instName: string;

test.describe('cicd/vllm-pd-disagg — prefill/decode disaggregation config round-trips', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await cleanupLbByName(recipe.name);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test('P/D disaggregation + per-endpoint roles/NIXL ports round-trip', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
