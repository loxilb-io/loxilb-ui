//---------------------------------------------------------
// cicd source: cicd/nat64tcp — NAT64 LB: IPv6 VIP, IPv4 endpoints.
//   loxicmd create lb 2001::1 --tcp=2020:8080 --endpoints=<v4>:1,…
// The gateway translates v6 ingress → v4 backends. Replayed as a UI
// LB-rule recipe (v6 VIP + v4 eps) and validated via REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/nat64tcp',
	name: 'e2e-cicd-nat64tcp',
	vip: '2001:db8::64:1',
	port: '2020',
	protocol: 'tcp',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/nat64tcp — NAT64 LB (v6 VIP, v4 endpoints)', () => {
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
