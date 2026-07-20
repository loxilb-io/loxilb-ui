//---------------------------------------------------------
// cicd source: cicd/tcplbmaxep — high endpoint count (16).
//   create_lb_rule llb1 <vip> --tcp=2020:8080 --endpoints=…×16
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcplbmaxep',
	name: 'e2e-cicd-tcplbmaxep',
	vip: "203.0.113.22",
	port: "2020",
	protocol: "tcp",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "8080"},
		{ip: "198.51.100.2", targetPort: "8080"},
		{ip: "198.51.100.3", targetPort: "8080"},
		{ip: "198.51.100.4", targetPort: "8080"},
		{ip: "198.51.100.5", targetPort: "8080"},
		{ip: "198.51.100.6", targetPort: "8080"},
		{ip: "198.51.100.7", targetPort: "8080"},
		{ip: "198.51.100.8", targetPort: "8080"},
		{ip: "198.51.100.9", targetPort: "8080"},
		{ip: "198.51.100.10", targetPort: "8080"},
		{ip: "198.51.100.11", targetPort: "8080"},
		{ip: "198.51.100.12", targetPort: "8080"},
		{ip: "198.51.100.13", targetPort: "8080"},
		{ip: "198.51.100.14", targetPort: "8080"},
		{ip: "198.51.100.15", targetPort: "8080"},
		{ip: "198.51.100.16", targetPort: "8080"},
	],
};

let instName: string;

test.describe('cicd/tcplbmaxep — high endpoint count (16)', () => {
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
