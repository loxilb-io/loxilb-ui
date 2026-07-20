//---------------------------------------------------------
// cicd source: cicd/tcplbhash — TCP L4 LB, select=hash, dnat.
// Same as tcplb but the scenario sets `--select=hash`; validates
// the gateway stores sel=1. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplbhash',
	name: 'e2e-cicd-tcplbhash',
	vip: '203.0.113.11',
	port: '2020',
	protocol: 'tcp',
	sel: 'hash',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/tcplbhash — TCP L4 LB (select=hash)', () => {
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

	test('UI create with select=hash round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
