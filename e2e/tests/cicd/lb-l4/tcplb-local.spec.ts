//---------------------------------------------------------
// cicd source: cicd/tcplb-local — single local endpoint.
//   create_lb_rule llb1 <vip> --tcp=2020:8080 --endpoints=<self>:1
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplb-local',
	name: 'e2e-cicd-tcplb-local',
	vip: "203.0.113.12",
	port: "2020",
	protocol: "tcp",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "8080"},
	],
};

let instName: string;

test.describe('cicd/tcplb-local — single local endpoint', () => {
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

	test('UI create round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
