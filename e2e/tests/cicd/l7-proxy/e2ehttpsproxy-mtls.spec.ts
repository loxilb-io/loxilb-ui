//---------------------------------------------------------
// cicd source: cicd/e2ehttpsproxy-mtls — L7 fullproxy, e2ehttps + frontend mTLS.
// Recipe POSTs {security, mode:4, host, mtls_frontend:{client_cert_mode:required,
//   client_ca_path, require_client_cn, client_cn_pattern}}. Replays it through
//   the UI (Mode=fullproxy → Security=e2ehttps → mTLS sub-form) and validates the
//   gateway's REST read-back. No traffic.
//
// NOTE on the security value: the cicd config.sh sets security:2 for this
// "e2ehttps" scenario — written against the OLD, buggy swagger enum description
// ("2-e2ehttps"). The corrected mapping is 2-tls, 3-e2ehttps, so this
// spec uses security=e2ehttps(3) — the scenario's actual intent — which also
// exercises the corrected enum together with mTLS.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/e2ehttpsproxy-mtls',
	name: 'e2e-cicd-e2ehttpsproxy-mtls',
	vip: '203.0.113.71',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'e2ehttps',
	host: '203.0.113.71',
	mtls: {
		clientCertMode: 'required',
		clientCaPath: '/opt/loxilb/cert/client_ca.crt',
		requireClientCn: true,
		clientCnPattern: '*.internal.corp.com',
	},
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/e2ehttpsproxy-mtls — L7 fullproxy (e2ehttps + frontend mTLS)', () => {
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
