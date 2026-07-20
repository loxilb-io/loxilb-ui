//---------------------------------------------------------
// cicd source: cicd/ipsec-e2e — multi-gateway IPsec + fullnat LB.
//   loxicmd create lb 192.168.10.200 --tcp=2020:8080
//   --endpoints=192.168.10.10:1,192.168.10.11:1 --mode=fullnat
//   (+ explicit endpoints with probetype=none)
// Reproduced with the UI tunnel model + a fullnat LB rule; both validated
// via REST read-back.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepIpsecTunnels, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';
import {assertTunnelReadback, cleanupTunnel, driveTunnelCreate, TunnelRecipe} from '../_ipsec';

const tunnel: TunnelRecipe = {
	cicd: 'cicd/ipsec-e2e',
	name: 'e2e-cicd-ipsec-e2e-tun',
	remoteIp: '203.0.113.77',
	psk: 'e2e-cicd-ipsec-e2e-secret',
	localSubnet: '203.0.113.0/24',
	remoteSubnet: '198.51.100.0/24',
};

const lb: LbRecipe = {
	cicd: 'cicd/ipsec-e2e',
	name: 'e2e-cicd-ipsec-e2e-lb',
	vip: '203.0.113.76',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullnat',
	endpoints: [
		{ip: '198.51.100.6', targetPort: '8080'},
		{ip: '198.51.100.7', targetPort: '8080'},
	],
};

let instName: string;

test.describe('cicd/ipsec-e2e — IPsec tunnel + fullnat LB across it', () => {
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

	test('UI creates tunnel + fullnat LB; both round-trip through the gateway', async ({page}) => {
		await driveTunnelCreate(page, instName, tunnel);
		await runLbScenario(page, instName, lb);
		await assertTunnelReadback(tunnel);
	});
});
