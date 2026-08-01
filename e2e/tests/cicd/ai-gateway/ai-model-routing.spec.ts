//---------------------------------------------------------
// cicd source: cicd/ai-model-routing — AI model routing.
//   fullproxy rules carrying model_name (llama-70b / mistral-7b / "" wildcard)
//   + host + path_prefix "/" + path_match_mode=prefix, so the gateway's
//   ephash key routes each request to the matching model's endpoint pool.
//
// Config surface only (plan §8): the cicd scenario keys three rules off the
// SAME VIP and lets the gateway route by model_name; the loxilb rule key is
// VIP:port:proto, so the UI/gateway can't hold two rules on one VIP:port.
// We therefore prove the ROUTING CONFIG — that model_name round-trips per
// rule — on distinct doc VIPs. No traffic; no live model.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const rules: LbRecipe[] = [
	{
		cicd: 'cicd/ai-model-routing',
		name: 'e2e-cicd-ai-route-llama',
		vip: '203.0.113.100',
		port: '2020',
		mode: 'fullproxy',
		host: '203.0.113.100',
		pathPrefix: '/',
		pathMatchMode: 'prefix',
		ai: {modelName: 'llama-70b'},
		endpoints: [{ip: '198.51.100.1', targetPort: '8000'}],
	},
	{
		cicd: 'cicd/ai-model-routing',
		name: 'e2e-cicd-ai-route-mistral',
		vip: '203.0.113.101',
		port: '2020',
		mode: 'fullproxy',
		host: '203.0.113.101',
		pathPrefix: '/',
		pathMatchMode: 'prefix',
		ai: {modelName: 'mistral-7b'},
		endpoints: [{ip: '198.51.100.2', targetPort: '8000'}],
	},
];

let instName: string;

test.describe('cicd/ai-model-routing — model_name routing config round-trips', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		for (const r of rules) await cleanupLbByName(r.name);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	for (const r of rules) {
		test(`${r.ai!.modelName}: model-routing rule round-trips through the gateway`, async ({page}) => {
			await runLbScenario(page, instName, r);
		});
	}
});
