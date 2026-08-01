//---------------------------------------------------------
// cicd source: cicd/sctplbmon — SCTP + health monitor.
//   loxicmd create lb <vip> --sctp=2020:8080 --endpoints=…:1 --monitor
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/sctplbmon',
	name: 'e2e-cicd-sctplbmon',
	vip: "203.0.113.43",
	port: "2020",
	protocol: "sctp",
	monitor: true,
	endpoints: [
		{ip: "198.51.100.1", targetPort: "8080"},
		{ip: "198.51.100.2", targetPort: "8080"},
		{ip: "198.51.100.3", targetPort: "8080"},
	],
};

let instName: string;

test.describe('cicd/sctplbmon — SCTP + health monitor', () => {
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
