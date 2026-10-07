//---------------------------------------------------------
// cicd source: cicd/http2-prefix-lb — HTTP/2 backend + path-prefix routing.
//
// NOTE: the cicd dir has no config.sh — only a `grpc-server/` stub — so there
// is no authoritative recipe to replay. This spec reconstructs the dir's intent
// from its name (http2 backend + path-prefix under fullproxy), combining the
// proven `http2ep` (backend_protocol=http2) and `*-prefix` (path_prefix +
// path_match_mode=prefix) surfaces. Since gRPC = HTTP/2 at the config layer
// (see e2ehttpsproxy-grpc), no distinct grpc value is involved. Validates
// the http2 + prefix combination round-trips via REST.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {fullproxyVip, activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

// A fullproxy rule is a listener the gateway binds, so its VIP is an address
// of the gateway (helpers/api.ts, fullproxyVip).
const FP_VIP = fullproxyVip();

const recipe: LbRecipe = {
	cicd: 'cicd/http2-prefix-lb',
	name: 'e2e-cicd-http2-prefix-lb',
	vip: FP_VIP,
	port: '20073',
	protocol: 'tcp',
	mode: 'fullproxy',
	host: FP_VIP,
	backendProtocol: 'http2',
	pathPrefix: '/v1/users',
	pathMatchMode: 'prefix',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/http2-prefix-lb — L7 fullproxy (http2 backend + path-prefix)', () => {
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
