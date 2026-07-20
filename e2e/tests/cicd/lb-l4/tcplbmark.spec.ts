//---------------------------------------------------------
// cicd source: cicd/tcplbmark — TCP L4 LB with a firewall mark.
//   loxicmd create lb <vip> --tcp=2020:8080 --endpoints=…:1 --mark=10
// The loxicmd `--mark` maps to the LB `block` serviceArgument. Exercises the
// P2 re-enabled Block control and validates the gateway REST read-back. No
// traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplbmark',
	name: 'e2e-cicd-tcplbmark',
	vip: '203.0.113.50',
	port: '2020',
	protocol: 'tcp',
	block: '10',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/tcplbmark — TCP L4 LB with fwmark (block)', () => {
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

	test('UI create with a firewall mark round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
