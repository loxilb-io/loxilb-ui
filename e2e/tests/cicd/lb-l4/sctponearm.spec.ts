//---------------------------------------------------------
// cicd source: cicd/sctponearm — SCTP onearm (38412→38412).
//   create_lb_rule llb1 <vip> --sctp=38412:38412 --endpoints=…:1 --mode=onearm
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/sctponearm',
	name: 'e2e-cicd-sctponearm',
	vip: "203.0.113.46",
	port: "38412",
	protocol: "sctp",
	mode: "onearm",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "38412"},
		{ip: "198.51.100.2", targetPort: "38412"},
	],
};

let instName: string;

test.describe('cicd/sctponearm — SCTP onearm (38412→38412)', () => {
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
