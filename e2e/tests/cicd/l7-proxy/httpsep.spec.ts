//---------------------------------------------------------
// cicd source: cicd/httpsep — HTTPS endpoint health probe (NOT LB TLS).
// @gw: upstream loxilb's LB-level probe accepts connect probes only
// (rules.go "malformed-service-ptype" — http/https 400), so this is a
// gateway scenario; the loxilb counterpart (tcp probe) lives in
// tests/flavor/loxilb-gating.spec.ts.
// Recipe: `loxicmd create lb 20.20.20.1 --tcp=2020:8080 --endpoints=… --monitor`
//   plus `loxicmd create endpoint … --probetype=https --probeport=8080
//   --probereq=health --proberesp=OK --retries=2`. This is an ENDPOINT PROBE
//   scenario (dnat rule + monitor + https probe), not L7 proxy security — the
//   probe fields are LB-level serviceArguments driven from the Endpoints form.
//   Replays it through the UI and validates the gateway's REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/httpsep',
	name: 'e2e-cicd-httpsep',
	vip: '203.0.113.68',
	port: '2020',
	protocol: 'tcp',
	monitor: true,
	probe: {type: 'HTTPS', port: '8080', req: 'health', resp: 'OK', timeout: '5', retries: '2'},
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/httpsep — HTTPS endpoint health probe (dnat + monitor)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await cleanupLbByName(recipe.name);
		await sweepLbRules();
		await sweepFirewallRules(); // dnat create leaves an auto FW allow-rule
	});

	test('UI create round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, recipe);
	});
});
