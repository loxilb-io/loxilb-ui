//---------------------------------------------------------
// cicd source: cicd/httpshostproxy — L7 fullproxy, https, host-based routing.
// Recipe: create_lb_rule --tcp=2020:8080 --mode=fullproxy --security=https
//   --host=loxilb.io (proxyonlymode). Replays it through the UI (Mode=
//   fullproxy → Security=https → Host=loxilb.io) and validates REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/httpshostproxy',
	name: 'e2e-cicd-httpshostproxy',
	vip: '203.0.113.64',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'https',
	host: 'loxilb.io',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/httpshostproxy — L7 fullproxy (https, host-based routing)', () => {
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
