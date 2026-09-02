//---------------------------------------------------------
// proof: an accepted mutation is reported by what the LIST shows,
// not by the fact that the POST returned 200.
//
// Both legs are fully intercepted — the POST is answered locally and the
// list GET is synthesized — so the testbed is never mutated and the cases
// reproduce identically forever (the timing here is the point, and a live
// gateway cannot be asked to converge slowly on demand).
//
//   converges late  → the success popup waits for the row to actually appear
//   never converges → 'Submitted', which is NEITHER a success NOR an error
//
// The second case is the stop-ship one: before the page said
// "Added successfully" the instant the POST was accepted and then looked
// exactly once, 1 s later, so a slow or silently-dropped write was reported
// to the operator as a completed one.
//---------------------------------------------------------
import {Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const HOST = '203.0.113.77'; // TEST-NET-3 documentation range — never routable
const EP_NAME = 'e2e-reconcile-probe';

let instName = '';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

/** Answer the CORS preflight, then hand the real method to `handler`. */
function intercept(method: string, handler: (route: Route) => Promise<void>) {
	return async (route: Route) => {
		if (route.request().method() === 'OPTIONS') {
			await route.fulfill({status: 204, headers: CORS});
			return;
		}
		if (route.request().method() !== method) {
			await route.fallback();
			return;
		}
		await handler(route);
	};
}

const acceptCreate = intercept('POST', route => route.fulfill({status: 200, headers: {...CORS, 'Content-Type': 'application/json'}, body: JSON.stringify({result: 'success'})}));

/** A list GET that omits our row for the first `blindReads` reads. */
function listConvergingAfter(blindReads: number, counter: {reads: number}) {
	return intercept('GET', async route => {
		counter.reads += 1;
		const converged = counter.reads > blindReads;
		const attr = converged ? [{hostName: HOST, name: EP_NAME, currState: 'ok', probePort: 0, probeType: 'ping'}] : [];
		await route.fulfill({status: 200, headers: {...CORS, 'Content-Type': 'application/json'}, body: JSON.stringify({Attr: attr})});
	});
}

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

async function submitEndpoint(page: import('@playwright/test').Page) {
	await page.goto(`instance/traffic/endpoint?name=${instName}`);
	await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: /New Endpoint/i}));
	await field(page, 'Host Name').fill(HOST);
	await field(page, 'Name').fill(EP_NAME);
	await dialog(page).getByRole('button', {name: /^(Add|Create)$/}).click();
}

test('a write that converges late is reported only once the list really shows it', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);
	const counter = {reads: 0};
	await page.route('**/netlox/v1/config/endpoint/all', listConvergingAfter(2, counter));
	await page.route('**/netlox/v1/config/endpoint', acceptCreate);

	await submitEndpoint(page);

	// The old code popped this the instant the POST returned. Now it may only
	// appear after the row is genuinely in the list — which takes several
	// reads, i.e. longer than the single 1 s look it used to get.
	await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 20_000});
	await expect(dialog(page)).toContainText('Added successfully.');
	expect(counter.reads).toBeGreaterThan(2);
});

test('a write that never appears is Submitted — never a success, never an error', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);
	const counter = {reads: 0};
	await page.route('**/netlox/v1/config/endpoint/all', listConvergingAfter(Number.MAX_SAFE_INTEGER, counter));
	await page.route('**/netlox/v1/config/endpoint', acceptCreate);

	await submitEndpoint(page);

	await expect(dialogTitle(page, 'Submitted')).toBeVisible({timeout: 30_000});
	await expect(dialog(page)).toContainText('has not appeared yet');
	// Not dressed up as done...
	await expect(page.getByText('Added successfully.')).toBeHidden();
	// ...and not reported as a failure either: the gateway did accept it.
	await expect(dialogTitle(page, 'Error')).toBeHidden();
	await expect(page.getByText('Failed to add endpoint.')).toBeHidden();
	// Bounded: it stopped polling instead of hammering the gateway forever.
	expect(counter.reads).toBeLessThanOrEqual(8);
});
