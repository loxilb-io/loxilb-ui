//---------------------------------------------------------
// cicd source: cicd/http2ep — HTTP/2 backend protocol (ALPN).
// Recipe POSTs serviceArguments {backend_protocol:http2} with NO mode field
// (gateway default = dnat). Validates the gateway's REST read-back of
// backend_protocol. No traffic.
//
// UI DEVIATION (documented): `backend_protocol` (like host/path_*/security) is
// an L7 concept and the UI gates the Backend Protocol control behind
// Mode=fullproxy — the cicd recipe sets it on a default (dnat) rule. Fullproxy
// is loxilb's L7 proxy mode where ALPN backend negotiation actually applies, so
// the UI gating is the correct product semantics; this spec drives the same
// backend_protocol=http2 surface under mode=fullproxy (the reachable form).
// The gateway tolerating backend_protocol on a dnat rule is a gateway looseness,
// not a UI gap — flagged for the gateway team, not fixed UI-side.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/http2ep',
	name: 'e2e-cicd-http2ep',
	vip: '203.0.113.67',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	backendProtocol: 'http2',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/http2ep — HTTP/2 backend protocol (fullproxy)', () => {
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
