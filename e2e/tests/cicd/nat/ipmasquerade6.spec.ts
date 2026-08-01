//---------------------------------------------------------
// cicd source: cicd/ipmasquerade6 — IPv6 source-NAT (masquerade) rule.
//   loxicmd create firewall --firewallRule="portName:ellb1l3ep1" --snat=3ffe::2
// Same config surface as ipmasquerade but with a v6 SNAT target, keyed on
// a documentation-range v6 sourceIP. Validated via REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules} from '../../../helpers/api';
import {cleanupFirewallBySource, FwRecipe, runFirewallScenario} from '../_fw';

const recipe: FwRecipe = {
	cicd: 'cicd/ipmasquerade6',
	sourceIP: '2001:db8::200/128',
	doSnat: true,
	toIP: '2001:db8::254',
};

let instName: string;

test.describe('cicd/ipmasquerade6 — IPv6 masquerade (SNAT) firewall rule', () => {
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
