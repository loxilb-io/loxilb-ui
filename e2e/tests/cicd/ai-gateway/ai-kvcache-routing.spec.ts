//---------------------------------------------------------
// cicd source: cicd/vllm-kvcache-routing-cpu (+ sglang-loxilb-kvcache) —
// KV-cache-aware routing.
//   fullproxy + host + pd_disagg_mode + KV routing fields (kvExactMode=1,
//   kvHashAlgo, kvBlockSize, kvZmqPort), endpoints carrying prefill/decode
//   roles so loxilb's per-prefill-EP ZMQ subscriber can populate the KV index.
//
// Config surface (plan §8): assert the KV-routing serviceArguments + the
// per-endpoint prefill/decode roles round-trip via REST. No ZMQ publisher, no
// live KV events.
//
// GAP (finding): cicd also sets `kvWarmupSec` on this rule, but the UI
// AIGatewaySettingsForm exposes no KV-warmup control (nor does
// IServiceArguments type it) — so it can't be driven. Recorded in plan §16;
// the expressible KV surface below is what this spec proves.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/vllm-kvcache-routing-cpu',
	name: 'e2e-cicd-ai-kvcache',
	vip: '203.0.113.108',
	port: '2020',
	mode: 'fullproxy',
	host: '203.0.113.108',
	// modelName: the gateway admits NO kvExactMode rule without model_name
	// ("must equal the served model and staged tokenizer identity" — admission
	// present since the pinned contract revision). Qwen3-0.6B is the cicd
	// scenario's KV_MODEL default.
	ai: {modelName: 'Qwen/Qwen3-0.6B', pdDisaggMode: true, kvExactMode: '1', kvHashAlgo: 'sha256_cbor', kvBlockSize: '16', kvZmqPort: '5557'},
	endpoints: [
		{ip: '198.51.100.61', targetPort: '8000', epRole: 'prefill'},
		{ip: '198.51.100.62', targetPort: '8000', epRole: 'decode'},
		{ip: '198.51.100.63', targetPort: '8000', epRole: 'prefill'},
		{ip: '198.51.100.64', targetPort: '8000', epRole: 'decode'},
	],
};

let instName: string;

test.describe('@gw cicd/vllm-kvcache-routing-cpu — KV-cache routing config round-trips', () => {
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

	test('KV routing fields + prefill/decode endpoint roles round-trip', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
