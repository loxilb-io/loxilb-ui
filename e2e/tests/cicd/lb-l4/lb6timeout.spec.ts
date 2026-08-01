//---------------------------------------------------------
// cicd source: cicd/lb6timeout — IPv6 VIP + inactive-timeout = 30s.
//   loxicmd create lb 2001::1 --tcp=2020:8080 --endpoints=…:1 --inatimeout=30
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/lb6timeout',
	name: 'e2e-cicd-lb6timeout',
	vip: "2001:db8::21",
	port: "2020",
	protocol: "tcp",
	inactiveTimeout: "30",
	endpoints: [
		{ip: "2001:db8::101", targetPort: "8080"},
		{ip: "2001:db8::102", targetPort: "8080"},
		{ip: "2001:db8::103", targetPort: "8080"},
	],
};

let instName: string;

test.describe('cicd/lb6timeout — IPv6 VIP + inactive-timeout = 30s', () => {
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
