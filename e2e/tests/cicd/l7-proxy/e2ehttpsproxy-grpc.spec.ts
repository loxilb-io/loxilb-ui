//---------------------------------------------------------
// cicd source: cicd/e2ehttpsproxy-grpc — L7 fullproxy, gRPC backend.
// Recipe POSTs {security:2, mode:4, host, backend_protocol:"http2"}.
//
// FINDING (CG-2 is NOT a real gap): the plan originally scoped a distinct
// `grpc` backend-protocol value. But the cicd recipe expresses gRPC purely as
// `backend_protocol: http2` (gRPC rides HTTP/2) — there is no `grpc` enum value
// anywhere in the gateway (backend_protocols = http1|http2|both) or the UI. So
// this is a plain fullproxy spec (tls + http2 backend + host), already fully
// UI-supported — no feature build. The gRPC-ness is a data-plane concern (ALPN
// h2 + gRPC framing), out of scope for a config round-trip test.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const recipe: LbRecipe = {
	cicd: 'cicd/e2ehttpsproxy-grpc',
	name: 'e2e-cicd-e2ehttpsproxy-grpc',
	vip: '203.0.113.72',
	port: '2022',
	protocol: 'tcp',
	mode: 'fullproxy',
	security: 'tls',
	host: '203.0.113.72',
	backendProtocol: 'http2',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/e2ehttpsproxy-grpc — L7 fullproxy (gRPC = tls + http2 backend)', () => {
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
