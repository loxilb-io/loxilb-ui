//---------------------------------------------------------
// cicd source: cicd/tcptunlb — TCP LB whose backends sit across a tunnel.
//   loxicmd create lb 88.88.88.88 --tcp=2020:8080 --endpoints=25.25.25.1:1,…
//
// The "tunnel" here is NETWORK TOPOLOGY (the backends are reached over an
// out-of-band tunnel interface), NOT an LB config flag — the loxicmd line
// carries no tunnel option, and neither the gateway LB model nor the cicd
// recipe expresses one. So (like the gRPC-value dissolution) the
// "tunnel-endpoint control" gap dissolves against the source of truth: the
// LB rule itself is a plain dnat rule, already fully UI-expressible. The
// public VIP/backends are re-keyed onto documentation ranges.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/tcptunlb',
	name: 'e2e-cicd-tcptunlb',
	vip: '203.0.113.88',
	port: '2020',
	protocol: 'tcp',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/tcptunlb — TCP LB over a tunnel topology (plain dnat rule)', () => {
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
