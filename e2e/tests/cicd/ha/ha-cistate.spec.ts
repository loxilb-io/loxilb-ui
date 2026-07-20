//---------------------------------------------------------
// cicd source: cicd/ha1 (+ cluster1/2/3) — HA config slice.
//   ha1:  spawn --with-ka out …; create_lb_rule llb 20.20.20.1
//         --tcp=2020:8080 --endpoints=…:1 --mode=fullnat  (×2 nodes,
//         keepalived-fronted). The single-node testbed can't stand up the
//         second node / real VIP failover, so this spec exercises the
//         CONFIG SLICE both HA scenarios rest on: the fullnat LB rule the
//         cluster fronts, and the cluster-instance state (/config/cistate)
//         the keepalived integration drives — read-modify-restore, no
//         failover ever triggered. (plan §7 Group F, CG-6.)
//
// Replayed through the real loxilb-ui + validated via REST read-back. No
// traffic; no VIP takeover (state kept NOT_DEFINED throughout).
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../../fixtures';
import {activeInstance, gw, gwJson, sweepFirewallRules, sweepLbRules} from '../../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../../helpers/form';
import {grid, toolbarButton} from '../../../helpers/table';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

// The fullnat LB rule ha1/cluster* front (doc-IP safety envelope substituted
// for 20.20.20.1 / 11.11.11.x). This is the rule keepalived's active node owns.
const lb: LbRecipe = {
	cicd: 'cicd/ha1',
	name: 'e2e-cicd-ha1',
	vip: '203.0.113.70',
	port: '2020',
	protocol: 'tcp',
	mode: 'fullnat',
	endpoints: [
		{ip: '198.51.100.1', targetPort: '8080'},
		{ip: '198.51.100.2', targetPort: '8080'},
		{ip: '198.51.100.3', targetPort: '8080'},
	],
};

// The cluster-instance state edit — an inert documentation VIP, state left
// NOT_DEFINED so loxilb never activates HA / touches the mgmt path.
const DOC_VIP = '203.0.113.71';

interface Cistate {
	instance: string;
	state: string;
	vip: string;
}

async function readCistate(): Promise<Cistate | null> {
	const data = await gwJson<{Attr?: Cistate[]}>('/config/cistate/all');
	return data.Attr?.[0] ?? null;
}

function haEditButton(page: Page) {
	return page.locator('[aria-label="Edit High Availability"] button');
}

async function openHaEdit(page: Page): Promise<void> {
	await grid(page).locator('.MuiDataGrid-row').first().getByRole('checkbox').check();
	await haEditButton(page).click();
	await expect(dialog(page).getByRole('heading', {name: 'New HA VIP'})).toBeVisible();
}

let instName: string;
let originalCistate: Cistate | null;

test.describe('cicd/ha1 + cluster* — HA config slice (fullnat LB + cistate round-trip)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		originalCistate = await readCistate();
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterAll(async () => {
		// Restore the original cluster state no matter what the tests left.
		if (originalCistate) {
			await gw('POST', '/config/cistate', {instance: originalCistate.instance, state: originalCistate.state, vip: originalCistate.vip});
		}
		await cleanupLbByName(lb.name);
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test('ha1: the fullnat LB rule the cluster fronts round-trips through the gateway', async ({page}) => {
		await runLbScenario(page, instName, lb);
	});

	test('cluster cistate: a doc-VIP edit round-trips through the HA page (read-modify-restore)', async ({page}) => {
		await page.goto(`instance/status/ha?name=${instName}`); // relative — baseURL carries /netlox
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});

		// The testbed must report a cluster instance for the HA slice to exist.
		const before = await readCistate();
		expect(before, 'testbed reports a cluster instance (/config/cistate)').not.toBeNull();

		await openHaEdit(page);
		const update = dialogButton(page, 'Update');
		await expect(update).toBeEnabled();

		// F-STATUS-3 sibling guard: a malformed VIP must block the round-trip.
		await field(page, 'VIP Address').fill('999.999.999.999');
		expect(await isEventuallyDisabled(update), 'garbage VIP blocks Update').toBe(true);

		// Keep state NOT_DEFINED (no VIP takeover); only the recorded VIP changes
		// to an inert documentation address.
		await field(page, 'VIP Address').fill(DOC_VIP);
		await expect(update).toBeEnabled();

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && /\/config\/cistate/.test(r.url()) && !r.url().includes('/all')),
			update.click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({state: 'NOT_DEFINED', vip: DOC_VIP});
		// The form's client-side validity flag must never reach the gateway.
		expect(body.isValid, 'isValid must not leak into the cistate payload').toBeUndefined();
		expect((await req.response())?.status(), 'gateway accepted the cistate POST').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
	});
});
