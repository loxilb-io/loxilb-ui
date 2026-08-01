//---------------------------------------------------------
// cicd source: cicd/ipmasquerade — source-NAT (masquerade) firewall rule.
//   loxicmd create firewall --firewallRule="portName:ellb1l3ep1" --snat=10.10.10.254
// The cicd recipe keys on a real interface; we reproduce the same config
// surface (a doSnat rule with a toIP) keyed on a documentation-range
// sourceIP so it stays sweepable + inert. Validated via REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules} from '../../../helpers/api';
import {cleanupFirewallBySource, FwRecipe, runFirewallScenario} from '../_fw';

const recipe: FwRecipe = {
	cicd: 'cicd/ipmasquerade',
	sourceIP: '203.0.113.200/32',
	doSnat: true,
	toIP: '198.51.100.254',
};

let instName: string;

test.describe('cicd/ipmasquerade — masquerade (SNAT) firewall rule', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await cleanupFirewallBySource(recipe.sourceIP);
		await sweepFirewallRules();
	});

	test('UI create round-trips through the gateway', async ({page}) => {
		await runFirewallScenario(page, instName, recipe);
	});
});
