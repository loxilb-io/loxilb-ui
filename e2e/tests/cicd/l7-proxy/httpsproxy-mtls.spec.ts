//---------------------------------------------------------
// cicd source: cicd/httpsproxy-mtls — L7 fullproxy, https + frontend mTLS.
// Recipe POSTs {security:1, mode:4, host, mtls_frontend:{client_cert_mode:
//   required, client_ca_path, require_client_cn:true, client_cn_pattern}}.
//   Replays it through the UI (Mode=fullproxy → Security=https → mTLS sub-form)
//   and validates the gateway's REST read-back of mtls_frontend. No traffic.
//
// P4 [FEATURE]: the LB dialog now exposes a frontend-mTLS sub-form
// (AdvancedSettingsForm), gated on mode=fullproxy + a TLS security. The gateway
// already supported mtls_frontend end-to-end (swagger + model + data plane) —
// this was a UI gap, so CG-1 is UI-only (no gateway change). The connector
// drops mtls_frontend when client_cert_mode is 'disabled' so non-mTLS rules stay
// clean (the dropdown auto-defaults to 'disabled').
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/httpsproxy-mtls',
	name: 'e2e-cicd-httpsproxy-mtls',
	vip: '203.0.113.70',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'https',
	host: '203.0.113.70',
	mtls: {
		clientCertMode: 'required',
		clientCaPath: '/opt/loxilb/cert/client_ca.crt',
		requireClientCn: true,
		clientCnPattern: '*.internal.corp.com',
	},
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/httpsproxy-mtls — L7 fullproxy (https + frontend mTLS)', () => {
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
