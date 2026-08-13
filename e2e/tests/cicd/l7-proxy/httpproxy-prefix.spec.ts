//---------------------------------------------------------
// cicd source: cicd/httpproxy-prefix — L7 fullproxy, path-prefix routing.
// Recipe POSTs serviceArguments {mode:4, host, path_prefix:/v1/users,
//   path_match_mode:prefix}. Replays it through the UI (Advanced → Mode=
//   fullproxy → Path Match Mode + Path Prefix) and validates REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/httpproxy-prefix',
	name: 'e2e-cicd-httpproxy-prefix',
	vip: '203.0.113.61',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	host: '203.0.113.61',
	pathPrefix: '/v1/users',
	pathMatchMode: 'prefix',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/httpproxy-prefix — L7 fullproxy (path-prefix routing)', () => {
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
