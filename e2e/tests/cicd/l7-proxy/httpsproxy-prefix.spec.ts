//---------------------------------------------------------
// cicd source: cicd/httpsproxy-prefix — L7 fullproxy, https + path-prefix.
// Recipe POSTs {mode:4, security:1, host, path_prefix:/v1, path_match_mode:
//   prefix}. Replays it through the UI (Mode=fullproxy → Security=https →
//   Path Match Mode + Path Prefix) and validates the gateway's REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {fullproxyVip, activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

// A fullproxy rule is a listener the gateway binds, so its VIP is an address
// of the gateway (helpers/api.ts, fullproxyVip).
const FP_VIP = fullproxyVip();

const recipe: LbRecipe = {
	cicd: 'cicd/httpsproxy-prefix',
	name: 'e2e-cicd-httpsproxy-prefix',
	vip: FP_VIP,
	port: '20063',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'https',
	host: FP_VIP,
	pathPrefix: '/v1',
	pathMatchMode: 'prefix',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/httpsproxy-prefix — L7 fullproxy (https + path-prefix)', () => {
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
