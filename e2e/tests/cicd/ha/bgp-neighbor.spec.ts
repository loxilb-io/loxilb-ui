//---------------------------------------------------------
// cicd source: cicd/cluster1 (+ cluster2/3, cluster-intKA) — BGP config slice.
//   cluster1:  spawn --with-bgp yes --bgp-config … (gobgp: neighbor
//              10.10.10.254, peer-as 64512);  create_lb_rule llb 20.20.20.1
//              --tcp=2020:8080 --endpoints=…:1 --mode=fullnat --bgp  (VIP
//              announced over BGP by the active cluster node).
//
// loxilb runs with BGP MODE DISABLED on this testbed — every /config/bgp/*
// mutation returns 403 "loxilb BGP mode is disabled" (see network/bgp.spec.ts).
// So the neighbor CREATE cannot round-trip. What this cicd slice DOES prove
// end-to-end, single-node:
//   • the `--bgp` fullnat LB rule the cluster fronts round-trips via REST
//     (the LB `bgp` flag is accepted + echoed even with BGP mode off);
//   • the BGP neighbor page reproduces the cluster recipe (peer + remoteAs
//     64512) in the POST body — UI→gateway fidelity — bounded by the 403 the
//     disabled testbed returns (documented, not hidden);
//   • the IP-validity gate holds: a malformed peer IP can't submit;
//   • the BGP global page renders (assert-only; a bad global config is the one
//     mutation that could disturb testbed routing — never sent).
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {ConsoleGuard, expect, test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules, sweepLbRules, sweepNeighbors} from '../../../helpers/api';
import {dialog, dialogButton, expectErrorAndDismiss} from '../../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../../helpers/form';
import {grid, toolbarButton} from '../../../helpers/table';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

// The cluster1 `--bgp` fullnat LB rule (doc-IP safety envelope substituted).
const lb: LbRecipe = {
	cicd: 'cicd/cluster1',
	name: 'e2e-cicd-cluster1-bgp',
	vip: '203.0.113.72',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullnat',
	bgp: true,
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

// The gobgp neighbor the cluster peers with (peer-as 64512), on a
// documentation address so a stray can never touch real config.
const PEER_IP = '203.0.113.73';
const REMOTE_AS = '64512';

// The disabled-BGP 403 (and its failed-fetch console line) are expected here.
function allowBgpDisabled(guard: ConsoleGuard): void {
	guard.allow(/Failed to load resource/i);
	guard.allow(/BGP mode is disabled/i);
	guard.allow(/Capacity insufficient/i);
	guard.allow(/403/);
}

async function gotoBgp(page: Page, path: string): Promise<void> {
	await page.goto(`instance/network/bgp/${path}?name=${instName}`); // relative — baseURL carries /netlox
}

let instName: string;

test.describe('cicd/cluster1 — BGP config slice (--bgp LB + neighbor recipe; BGP mode disabled)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
		await sweepNeighbors();
	});

	test.afterEach(async () => {
		await cleanupLbByName(lb.name);
		await sweepLbRules();
		await sweepFirewallRules();
		await sweepNeighbors();
	});

	test('cluster --bgp: the fullnat LB rule with the BGP-announce flag round-trips', async ({page}) => {
		// The LB `bgp` flag is accepted and echoed back even though BGP routing is
		// disabled (the flag only marks the rule for announcement) — verified live.
		await runLbScenario(page, instName, lb);
	});

	test('neighbor page renders and degrades on the disabled-BGP 403 (no-redirect guard)', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await gotoBgp(page, 'neighbor');
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible({timeout: 20_000});
		// consoleGuard (auto) enforces: no unexpected errors + no error-page redirect.
	});

	test('neighbor form reproduces the cluster recipe (peer + remoteAs 64512) in the POST body', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await gotoBgp(page, 'neighbor');
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});

		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('BGP Neighbor')).toBeVisible();

		const add = dialogButton(page, 'Add');
		// Gated on a valid peer IP — empty form can't submit.
		expect(await isEventuallyDisabled(add), 'empty peer IP blocks Add').toBe(true);

		await field(page, 'IP Address').fill(PEER_IP);
		await field(page, 'Remote AS').fill(REMOTE_AS);
		await field(page, 'Remote Port').fill('179');
		await expect(add).toBeEnabled();

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && /\/config\/bgp\/neigh(\?|$)/.test(r.url())),
			add.click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({ipAddress: PEER_IP});
		expect(Number(body.remoteAs), 'peer-as 64512 carried verbatim').toBe(64512);
		expect(body.isValid, 'client validity flag must not leak into the payload').toBeUndefined();

		// The disabled-BGP testbed rejects the create — the documented bound of this
		// single-node slice. The UI→recipe fidelity above is what the spec proves.
		expect((await req.response())?.status(), 'BGP disabled → 403').toBe(403);
		await expectErrorAndDismiss(page);
	});

	test('V-peer-ip: a malformed peer IP cannot be submitted', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await gotoBgp(page, 'neighbor');
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});

		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('BGP Neighbor')).toBeVisible();
		const add = dialogButton(page, 'Add');

		await field(page, 'IP Address').fill('999.1.1.1');
		expect(await isEventuallyDisabled(add), 'garbage peer IP blocks Add').toBe(true);

		await field(page, 'IP Address').fill(PEER_IP);
		await expect(add).toBeEnabled();
		await dialogButton(page, 'Cancel').click();
		await expect(dialog(page)).toBeHidden();
	});

	test('BGP global page renders (assert-only; routing-safe, never mutated)', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await gotoBgp(page, 'global');
		await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});
	});
});
