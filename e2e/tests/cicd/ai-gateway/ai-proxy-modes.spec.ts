//---------------------------------------------------------
// cicd source: cicd/vllm-httpproxy, cicd/vllm-fullproxy, cicd/mcp-e2ehttps —
// AI proxy security modes (collapsed to the config surface each demonstrates,
// plan §8). All fullproxy + host; they differ only by TLS security:
//   • vllm-httpproxy   → Plain (HTTP, security omitted)
//   • vllm-fullproxy   → https (TLS terminate)
//   • mcp-e2ehttps     → e2ehttps (end-to-end TLS)
//
// NOTE on the e2ehttps value: the cicd mcp-e2ehttps config.sh sets
// `security: 2` under the OLD (buggy) enum doc where "2" was mislabelled
// e2ehttps; the corrected mapping (F-CICD-3) is tls=2, e2ehttps=3, so this
// spec drives the corrected value (exercising the F-CICD-3 fix), matching the
// P4 e2ehttpsproxy-mtls precedent.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario, SecurityName} from '../_recipes';

interface ProxyMode {
	cicd: string;
	slug: string;
	vip: string;
	security?: SecurityName;
}

const modes: ProxyMode[] = [
	{cicd: 'cicd/vllm-httpproxy', slug: 'plain', vip: '203.0.113.104'}, // HTTP → security omitted (Plain=0)
	{cicd: 'cicd/vllm-fullproxy', slug: 'https', vip: '203.0.113.105', security: 'https'},
	{cicd: 'cicd/mcp-e2ehttps', slug: 'e2ehttps', vip: '203.0.113.106', security: 'e2ehttps'},
];

function recipe(m: ProxyMode): LbRecipe {
	return {
		cicd: m.cicd,
		name: `e2e-cicd-ai-proxy-${m.slug}`,
		vip: m.vip,
		port: '2020',
		mode: 'fullproxy',
		host: m.vip,
		security: m.security,
		endpoints: [{ip: '198.51.100.1', targetPort: '8080'}],
	};
}

let instName: string;

test.describe('cicd/vllm|mcp proxy — AI proxy security modes round-trip', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		for (const m of modes) await cleanupLbByName(`e2e-cicd-ai-proxy-${m.slug}`);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	for (const m of modes) {
		test(`${m.slug}: fullproxy AI proxy (${m.cicd}) round-trips`, async ({page}) => {
			await runLbScenario(page, instName, recipe(m));
		});
	}
});
