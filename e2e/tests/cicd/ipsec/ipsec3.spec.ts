//---------------------------------------------------------
// cicd source: cicd/ipsec3 — IPsec tunnel + onearm LB across it.
//   loxicmd create lb 192.168.10.200 --tcp=2020:8080
//   --endpoints=192.168.10.10:1 --mode=onearm
// Reproduced with the UI tunnel model + an onearm LB rule; both validated
// via REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepIpsecTunnels, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';
import {assertTunnelReadback, cleanupTunnel, driveTunnelCreate, TunnelRecipe} from '../_ipsec';

const tunnel: TunnelRecipe = {
	cicd: 'cicd/ipsec3',
	name: 'e2e-cicd-ipsec3-tun',
	remoteIp: '203.0.113.75',
	psk: 'e2e-cicd-ipsec3-secret',
	localSubnet: '203.0.113.0/24',
	remoteSubnet: '198.51.100.0/24',
};

const lb: LbRecipe = {
	cicd: 'cicd/ipsec3',
	name: 'e2e-cicd-ipsec3-lb',
	vip: '203.0.113.74',
	port: '2020',
	protocol: 'tcp',
	mode: 'onearm',
	endpoints: [{ip: '198.51.100.5', targetPort: '8080'}],
};

let instName: string;

test.describe('cicd/ipsec3 — IPsec tunnel + onearm LB across it', () => {
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

	test('UI creates tunnel + onearm LB; both round-trip through the gateway', async ({page}) => {
		await driveTunnelCreate(page, instName, tunnel);
		await runLbScenario(page, instName, lb);
		await assertTunnelReadback(tunnel);
	});
});
