//---------------------------------------------------------
// cicd source: cicd/tcplb — TCP L4 LB, rr/dnat, 3 endpoints.
// Replays the scenario's `create_lb_rule --tcp=2020:8080
// --endpoints=…:1,…:1,…:1` recipe through the UI and validates
// the gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplb',
	name: 'e2e-cicd-tcplb',
	vip: '203.0.113.10',
	port: '2020',
	protocol: 'tcp',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/tcplb — TCP L4 LB (rr/dnat, 3 eps)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await cleanupLbByName(recipe.name);
		await sweepLbRules();
		await sweepFirewallRules(); // dnat create leaves an auto FW allow-rule
	});

	test('UI create round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
