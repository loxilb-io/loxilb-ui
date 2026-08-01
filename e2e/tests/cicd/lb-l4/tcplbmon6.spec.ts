//---------------------------------------------------------
// cicd source: cicd/tcplbmon6 — IPv6 VIP + health monitor.
//   loxicmd create lb 2001::1 --tcp=2020:8080 --endpoints=…:1 --monitor
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplbmon6',
	name: 'e2e-cicd-tcplbmon6',
	vip: "2001:db8::20",
	port: "2020",
	protocol: "tcp",
	monitor: true,
	endpoints: [
		{ip: "2001:db8::101", targetPort: "8080"},
		{ip: "2001:db8::102", targetPort: "8080"},
		{ip: "2001:db8::103", targetPort: "8080"},
	],
};

let instName: string;

test.describe('cicd/tcplbmon6 — IPv6 VIP + health monitor', () => {
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
