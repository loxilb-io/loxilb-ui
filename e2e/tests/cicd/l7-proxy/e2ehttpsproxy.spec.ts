//---------------------------------------------------------
// cicd source: cicd/e2ehttpsproxy — L7 fullproxy, end-to-end TLS (e2ehttps).
// Recipe: create_lb_rule --tcp=2020:8080 --mode=fullproxy --security=e2ehttps
//   --host=10.10.10.254. Replays it through the UI (Mode=fullproxy →
//   Security=e2ehttps → Host) and validates the gateway's REST read-back.
//
// NOTE on the security value: e2ehttps is 2 per both backends' common.LBSec
// (Plain=0/HTTPS=1/E2EHTTPS=2); the swagger description that claimed
// "2-tls, 3-e2ehttps" was a spec bug — the datapath has no branch for 3 and
// silently degrades it to plain. This matches the cicd config.sh original.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/e2ehttpsproxy',
	name: 'e2e-cicd-e2ehttpsproxy',
	vip: '203.0.113.65',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'e2ehttps',
	host: '203.0.113.65',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/e2ehttpsproxy — L7 fullproxy (end-to-end TLS)', () => {
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
