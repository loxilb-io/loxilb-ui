//---------------------------------------------------------
// cicd source: cicd/egresslb — egress LB + egress SNAT firewall rule.
//   loxicmd create lb 0.0.0.0 --tcp=9999:9999 --endpoints=… --egress
//   loxicmd create firewall --firewallRule="sourceIP:32.32.32.1/32" \
//                           --snat=172.17.0.41 --egress
//
// Two halves:
//  1. The egress LB rule — the `egress` flag was re-enabled on the LB form in
//     P2. This spec drives it and (adversarially) asserts it ROUND-TRIPS via
//     REST, not just that create is accepted — `egress` could be write-only
//     like `privateIP`/`snat` on fullnat (F-CICD-2). The cicd wildcard VIP
//     0.0.0.0 is re-keyed to a documentation VIP so the rule stays sweepable.
//  2. The egress SNAT FIREWALL rule — NOT expressible: the gateway REST
//     firewall model (`api/models/firewall_option_entry.go`) has NO `egress`
//     field (only the loxicmd path has `--egress`), and neither does the UI
//     Firewall form. That is a genuine gateway-REST gap (CG-4, hand-off), so
//     the firewall-egress half is documented here rather than driven — a UI
//     control that POSTs an `egress` the gateway silently drops would be worse
//     than none. See docs/E2E_CICD_SCENARIO_TEST_PLAN.md §16 / gap CG-4.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/egresslb',
	name: 'e2e-cicd-egresslb',
	vip: '203.0.113.99',
	port: '9999',
	protocol: 'tcp',
	egress: true,
	endpoints: [
		{ip: '198.51.100.10', targetPort: '9999'},
		{ip: '198.51.100.11', targetPort: '9999'},
	],
};

let instName: string;

test.describe('cicd/egresslb — egress LB rule (egress flag round-trip)', () => {
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

	test('UI creates the egress LB rule; egress flag round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
