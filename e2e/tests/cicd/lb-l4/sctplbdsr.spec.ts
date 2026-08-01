//---------------------------------------------------------
// cicd source: cicd/sctplbdsr — SCTP DSR + select=hash.
//   loxicmd create lb --select=hash <vip> --sctp=2020:2020 --endpoints=…:1 --mode=dsr
// Replayed as a UI LB-rule recipe and validated against the
// gateway's REST read-back. No traffic.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/sctplbdsr',
	name: 'e2e-cicd-sctplbdsr',
	vip: "203.0.113.42",
	port: "2020",
	protocol: "sctp",
	sel: "hash",
	mode: "dsr",
	endpoints: [
		{ip: "198.51.100.1", targetPort: "2020"},
		{ip: "198.51.100.2", targetPort: "2020"},
		{ip: "198.51.100.3", targetPort: "2020"},
	],
};

let instName: string;

test.describe('cicd/sctplbdsr — SCTP DSR + select=hash', () => {
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
