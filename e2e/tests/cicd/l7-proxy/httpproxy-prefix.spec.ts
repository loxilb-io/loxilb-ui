//---------------------------------------------------------
// cicd source: cicd/httpproxy-prefix — L7 fullproxy, path-prefix routing.
// Recipe POSTs serviceArguments {mode:4, host, path_prefix:/v1/users,
//   path_match_mode:prefix}. Replays it through the UI (Advanced → Mode=
//   fullproxy → Path Match Mode + Path Prefix) and validates REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {fullproxyVip, activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

// A fullproxy rule is a listener the gateway binds, so its VIP is an address
// of the gateway (helpers/api.ts, fullproxyVip).
const FP_VIP = fullproxyVip();

const recipe: LbRecipe = {
	cicd: 'cicd/httpproxy-prefix',
	name: 'e2e-cicd-httpproxy-prefix',
	vip: FP_VIP,
	port: '20061',
	protocol: 'tcp',
	mode: 'fullproxy',
	host: FP_VIP,
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
