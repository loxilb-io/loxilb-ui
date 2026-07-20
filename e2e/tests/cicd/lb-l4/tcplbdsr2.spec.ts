//---------------------------------------------------------
// cicd source: cicd/tcplbdsr2 — DSR mode + select=hash (variant 2).
//   loxicmd create lb <vip> --select=hash --tcp=2020:2020 --endpoints=…:1 --mode=dsr
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplbdsr2',
	name: 'e2e-cicd-tcplbdsr2',
	vip: "203.0.113.18",
	port: "2020",
	protocol: "tcp",
	sel: "hash",
	mode: "dsr",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "2020"},
		{ip: "198.51.100.2", targetPort: "2020"},
		{ip: "198.51.100.3", targetPort: "2020"},
	],
};

let instName: string;

test.describe('cicd/tcplbdsr2 — DSR mode + select=hash (variant 2)', () => {
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
