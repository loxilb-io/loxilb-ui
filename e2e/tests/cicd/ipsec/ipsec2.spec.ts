//---------------------------------------------------------
// cicd source: cicd/ipsec2 — IPsec tunnel (strongswan ipsec.conf variant)
//   + loxicmd create lb 20.20.20.1 --tcp=2020:8080
//   --endpoints=25.25.25.1:1,26.26.26.1:1 (dnat).
// Same scenario shape as ipsec1 with a distinct peer/VIP; reproduced with
// the UI tunnel model + LB rule and validated via REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepIpsecTunnels, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';
import {assertTunnelReadback, cleanupTunnel, driveTunnelCreate, TunnelRecipe} from '../_ipsec';

const tunnel: TunnelRecipe = {
	cicd: 'cicd/ipsec2',
	name: 'e2e-cicd-ipsec2-tun',
	remoteIp: '203.0.113.73',
	psk: 'e2e-cicd-ipsec2-secret',
	localSubnet: '203.0.113.0/24',
	remoteSubnet: '198.51.100.0/24',
};

const lb: LbRecipe = {
	cicd: 'cicd/ipsec2',
	name: 'e2e-cicd-ipsec2-lb',
	vip: '203.0.113.72',
	port: '2020',
	protocol: 'tcp',
	endpoints: [
		{ip: '198.51.100.3', targetPort: '8080'},
		{ip: '198.51.100.4', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/ipsec2 — IPsec tunnel + dnat LB across it', () => {
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
