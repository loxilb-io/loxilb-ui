//---------------------------------------------------------
// cicd source: cicd/httpsproxy — L7 fullproxy, TLS terminate (security=https).
// Recipe: create_lb_rule --tcp=2020:8080 --mode=fullproxy --security=https
//   --host=10.10.10.254. Replays it through the UI (Mode=fullproxy →
//   Security=https → Host) and validates the gateway's REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/httpsproxy',
	name: 'e2e-cicd-httpsproxy',
	vip: '203.0.113.62',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'https',
	host: '203.0.113.62',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/httpsproxy — L7 fullproxy (TLS terminate, https)', () => {
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
