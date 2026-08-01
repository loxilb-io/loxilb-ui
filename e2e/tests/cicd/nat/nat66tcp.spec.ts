//---------------------------------------------------------
// cicd source: cicd/nat66tcp — NAT66 LB: IPv6 VIP, IPv6 endpoints, tcp.
//   loxicmd create lb 2001::1 --tcp=2020:8080 --endpoints=<v6>:1,…
// Replayed as a UI LB-rule recipe (v6 VIP + v6 eps) + REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/nat66tcp',
	name: 'e2e-cicd-nat66tcp',
	vip: '2001:db8::66:1',
	port: '2020',
	protocol: 'tcp',
	endpoints: [
		{ip: '2001:db8::a1', targetPort: '8080'},
		{ip: '2001:db8::a2', targetPort: '8080'},
		{ip: '2001:db8::a3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/nat66tcp — NAT66 LB (v6 VIP, v6 endpoints, tcp)', () => {
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
