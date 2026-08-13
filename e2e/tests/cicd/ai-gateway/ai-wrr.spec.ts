//---------------------------------------------------------
// cicd source: cicd/vllm-fullproxy-wrr (+ vllm-httpproxy-wrr) — weighted CHWBL.
//   fullproxy + security=https + host + sel=chwbl + chwbl_prefix_hash_level=1,
//   endpoints weighted 8:2 — CHWBL consistent-hash routing with weighted
//   replication (the "chwblwrr" round-trip the cicd validation.sh keys on).
//
// Config surface (plan §8): assert the weighted endpoints + CHWBL level
// round-trip via REST. The full endpoint tuple (IP+targetPort+weight) is
// validated, so a dropped/coerced 8:2 weight is caught.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/vllm-fullproxy-wrr',
	name: 'e2e-cicd-ai-wrr',
	vip: '203.0.113.107',
	port: '2020',
	mode: 'fullproxy',
	sel: 'chwbl',
	security: 'https',
	host: '203.0.113.107',
	ai: {chwblPrefixHashLevel: '1'},
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8000', weight: '8'},
		{ip: '198.51.100.2', targetPort: '8000', weight: '2'},
	],
};

let instName: string;

test.describe('@gw cicd/vllm-fullproxy-wrr — weighted CHWBL (8:2) config round-trips', () => {
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

	test('CHWBL sel + 8:2 weighted endpoints round-trip through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
