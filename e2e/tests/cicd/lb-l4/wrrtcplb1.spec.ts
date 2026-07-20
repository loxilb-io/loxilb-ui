//---------------------------------------------------------
// cicd source: cicd/wrrtcplb1 — weighted (priority) 80/20.
//   loxicmd create lb <vip> --select=priority --tcp=2020:8080 --endpoints=…:80,…:20
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/wrrtcplb1',
	name: 'e2e-cicd-wrrtcplb1',
	vip: "203.0.113.15",
	port: "2020",
	protocol: "tcp",
	sel: "priority",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "8080", weight: "80"},
		{ip: "198.51.100.2", targetPort: "8080", weight: "20"},
	],
};

let instName: string;

test.describe('cicd/wrrtcplb1 — weighted (priority) 80/20', () => {
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
