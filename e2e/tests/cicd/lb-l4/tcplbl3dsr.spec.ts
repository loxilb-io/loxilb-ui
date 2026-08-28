//---------------------------------------------------------
// cicd source: cicd/tcplbl3dsr — L3 DSR + select=hash. The live replay uses
// 18019 because this deployment reserves host port 8080 for OAM.
//   create_lb_rule llb1 <vip> --select=hash --tcp=8080:8080 --endpoints=…:1 --mode=dsr
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplbl3dsr',
	name: 'e2e-cicd-tcplbl3dsr',
	vip: "203.0.113.19",
	port: "18019",
	protocol: "tcp",
	sel: "hash",
	mode: "dsr",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "18019"},
		{ip: "198.51.100.2", targetPort: "18019"},
		{ip: "198.51.100.3", targetPort: "18019"},
	],
};

let instName: string;

test.describe('cicd/tcplbl3dsr — L3 DSR + select=hash', () => {
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
