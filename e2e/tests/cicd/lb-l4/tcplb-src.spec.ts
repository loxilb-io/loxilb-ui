//---------------------------------------------------------
// cicd source: cicd/tcplb-src — restricted to an allowed source CIDR.
//   create_lb_rule llb1 <vip> --tcp=2020:8080 --endpoints=…:1 --sources=<cidr>
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplb-src',
	name: 'e2e-cicd-tcplb-src',
	vip: "203.0.113.13",
	port: "2020",
	protocol: "tcp",
	allowedSources: ["198.51.100.0/32"],
	endpoints: [
		{ip: "198.51.100.1", targetPort: "8080"},
		{ip: "198.51.100.2", targetPort: "8080"},
		{ip: "198.51.100.3", targetPort: "8080"},
	],
};

let instName: string;

test.describe('cicd/tcplb-src — restricted to an allowed source CIDR', () => {
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
