//---------------------------------------------------------
// cicd source: cicd/ipsec1 — site-to-site IPsec tunnel + LB across it.
//   (llb1↔llb2 xfrm/vti tunnel) + loxicmd create lb 20.20.20.1
//   --tcp=2020:8080 --endpoints=25.25.25.1:1,26.26.26.1:1 (dnat)
// Reproduced with the UI's tunnel model (PSK responder) + the LB rule;
// both validated via REST read-back. Config-created only — the tunnel
// lands DOWN (no reachable peer on the single-node testbed).
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepIpsecTunnels, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';
import {assertTunnelReadback, cleanupTunnel, driveTunnelCreate, TunnelRecipe} from '../_ipsec';

const tunnel: TunnelRecipe = {
	cicd: 'cicd/ipsec1',
	name: 'e2e-cicd-ipsec1-tun',
	remoteIp: '203.0.113.71',
	psk: 'e2e-cicd-ipsec1-secret',
	localSubnet: '203.0.113.0/24',
	remoteSubnet: '198.51.100.0/24',
};

const lb: LbRecipe = {
	cicd: 'cicd/ipsec1',
	name: 'e2e-cicd-ipsec1-lb',
	vip: '203.0.113.70',
	port: '2020',
	protocol: 'tcp',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
	],
};

let instName: string;

test.describe('@gw cicd/ipsec1 — IPsec tunnel + dnat LB across it', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepIpsecTunnels();
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await cleanupTunnel(tunnel.name);
		await cleanupLbByName(lb.name);
		await sweepIpsecTunnels();
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test('UI creates tunnel + LB; both round-trip through the gateway', async ({page}) => {
		await driveTunnelCreate(page, instName, tunnel);
		await runLbScenario(page, instName, lb);
		await assertTunnelReadback(tunnel);
	});
});
