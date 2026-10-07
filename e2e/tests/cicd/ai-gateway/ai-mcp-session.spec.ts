//---------------------------------------------------------
// cicd source: cicd/mcp-fullproxy (+ mcp-httpproxy) — MCP session routing.
//   fullproxy + security=https + host + session_header_name=mcp-session-id,
//   in two selection modes: sel=rr (2020) and sel=persist (2021). The session
//   header pins each MCP session to a backend (with sel=persist) / carries the
//   MCP session id for stateful tool calls.
//
// Config surface (plan §8): assert session_header_name (+ security/host/sel)
// round-trip via REST. No MCP server, no live session.
//---------------------------------------------------------
import {test} from '../../../fixtures';
import {fullproxyVip, activeInstance, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario, SelName} from '../_recipes';

// A fullproxy rule is a listener the gateway binds, so its VIP is an address
// of the gateway (helpers/api.ts, fullproxyVip).
const FP_VIP = fullproxyVip();

interface McpMode {
	slug: string;
	vip: string;
	port: string;
	sel: SelName;
}

const modes: McpMode[] = [
	{slug: 'rr', vip: FP_VIP, port: '21110', sel: 'rr'},
	{slug: 'persist', vip: FP_VIP, port: '21111', sel: 'persist'},
];

function recipe(m: McpMode): LbRecipe {
	return {
		cicd: 'cicd/mcp-fullproxy',
		name: `e2e-cicd-ai-mcp-${m.slug}`,
		vip: m.vip,
		port: m.port,
		mode: 'fullproxy',
		sel: m.sel,
		security: 'https',
		host: m.vip,
		ai: {sessionHeaderName: 'mcp-session-id'},
		endpoints: [
			{ip: '198.51.100.1', targetPort: '8080'},
			{ip: '198.51.100.2', targetPort: '8080'},
		],
	};
}

let instName: string;

test.describe('@gw cicd/mcp-fullproxy — MCP session-header routing config round-trips', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		for (const m of modes) await cleanupLbByName(`e2e-cicd-ai-mcp-${m.slug}`);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	for (const m of modes) {
		test(`sel=${m.sel}: mcp-session-id header + fullproxy https round-trips`, async ({page}) => {
			await runLbScenario(page, instName, recipe(m));
		});
	}
});
