//---------------------------------------------------------
// cicd source: cicd/sctptunlb — SCTP LB whose backends sit across a tunnel.
//   loxicmd create lb 88.88.88.88 --sctp=2020:8080 --endpoints=25.25.25.1:1,…
// Same tunnel-is-topology dissolution as tcptunlb (CG-5): a plain dnat SCTP
// LB rule, re-keyed onto documentation ranges.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/sctptunlb',
	name: 'e2e-cicd-sctptunlb',
	vip: '203.0.113.89',
	port: '2020',
	protocol: 'sctp',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/sctptunlb — SCTP LB over a tunnel topology (plain dnat rule)', () => {
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
