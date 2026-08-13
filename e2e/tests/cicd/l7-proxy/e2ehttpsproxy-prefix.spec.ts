//---------------------------------------------------------
// cicd source: cicd/e2ehttpsproxy-prefix — L7 fullproxy, e2ehttps + path-prefix.
// Recipe POSTs {mode:4, security:2, host, path_prefix:/v1/users, path_match_mode:
//   prefix}. Replays it through the UI (Mode=fullproxy → Security=e2ehttps →
//   Path Match Mode + Path Prefix) and validates the gateway's REST read-back.
// Same security-value note as cicd/e2ehttpsproxy (e2ehttps=2; "3" was a
// swagger-description bug with no datapath branch).
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/e2ehttpsproxy-prefix',
	name: 'e2e-cicd-e2ehttpsproxy-prefix',
	vip: '203.0.113.66',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'e2ehttps',
	host: '203.0.113.66',
	pathPrefix: '/v1/users',
	pathMatchMode: 'prefix',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/e2ehttpsproxy-prefix — L7 fullproxy (e2ehttps + path-prefix)', () => {
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
