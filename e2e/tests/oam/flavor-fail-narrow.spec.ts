//---------------------------------------------------------
// fail-narrow capability resolution,
// in a browser, against a real inference-gateway instance.
//
// This is the release stop-ship this work closed: "unresolved / failed /
// denied instance flavor discovery exposes Gateway-only controls". The old
// code answered every capability question as the gateway while the /version
// probe was unresolved, and a denied probe was never cached — so a user the
// gateway refuses to identify itself to kept the full gateway control surface
// for the rest of the session.
//
// Why this spec has to exist even though e2e/oss/tests/gating.spec.ts covers
// flavor gating: that suite proves the RESOLVED-loxilb direction against a
// real loxilb instance. It cannot reach the three non-resolved situations at
// all, and those are exactly where the defect lived. Here the probe is
// intercepted, so `loading`, `denied` and `unavailable` each get pinned
// deterministically — and case 4 runs the same assertions with NO
// interception, so a regression that hid the AI menu from everyone could not
// pass this file by making cases 1-3 vacuously true.
//
// Nothing is mutated: every case answers one GET and touches no other route.
//---------------------------------------------------------
import {Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {toolbarButton} from '../../helpers/table';

let instName = '';

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

// The capability probe. Both the flavor hook and the instance health check
// call it; intercepting the path covers the app's whole view of "what is this
// instance", which is the point — a half-intercepted probe would let one
// caller resolve the flavor behind the test's back.
const VERSION_URL = '**/netlox/v1/version';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	'Access-Control-Expose-Headers': 'X-Loxi-Error-Origin',
};

/** Answer the probe with `status`, and count how often it was asked. */
function probeAnswers(status: number, counter: {n: number}) {
	return async (route: Route) => {
		if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
		counter.n++;
		// The gateway-origin marker keeps a 401/403 on this hop from being read
		// as the operator's OAM session ending (the app would tear itself down
		// and every later spec in the run would fail on a revoked token).
		return route.fulfill({
			status,
			headers: {...CORS, 'X-Loxi-Error-Origin': 'gateway', 'Content-Type': 'application/json'},
			body: JSON.stringify({error: 'intercepted by e2e'}),
		});
	};
}

/** The probe never answers at all — the app stays in `loading` for the whole test. */
function probeHangs(counter: {n: number}) {
	return async (route: Route) => {
		if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
		counter.n++;
		// Deliberately unresolved: no fulfill, no continue, no abort.
	};
}

/** A deliberately broken probe is loud in the console; that noise is the point. */
function allowProbeNoise(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of (4\d\d|5\d\d)/i);
	consoleGuard.allow(/net::ERR_FAILED/);
	consoleGuard.allow(/Failed to fetch/i);
	consoleGuard.allow(/Network request failed/i);
	// Pages behind the guard never issue their reads, and the dashboard's
	// pollers keep running against a probe that is not answering.
	consoleGuard.allow(/timeout/i);
}

// Groups that exist ONLY on the inference gateway. On a resolved gateway they
// are in the drawer; in every non-resolved situation they must be absent —
// not disabled, absent — because offering a control that will 404 (or worse,
// write outside the OSS contract) is the defect.
const GATEWAY_ONLY_GROUPS = ['AI Gateway', 'IPsec VPN'];
// Shared groups, present on both flavors. They must survive fail-narrow:
// answering "narrowest set" must not degrade into "no product at all".
const SHARED_GROUPS = ['Traffic', 'Networks', 'Status'];

const drawer = (page: import('@playwright/test').Page) => page.locator('.MuiDrawer-paper');

/** Every gateway-only entry gone, every shared entry still there. */
async function expectNarrowNav(page: import('@playwright/test').Page): Promise<void> {
	for (const group of SHARED_GROUPS) {
		await expect(drawer(page).getByText(group, {exact: true}), `${group} must survive fail-narrow`).toBeVisible({timeout: 20_000});
	}
	for (const group of GATEWAY_ONLY_GROUPS) {
		await expect(drawer(page).getByText(group, {exact: true}), `${group} must not be offered while the flavor is unresolved`).toHaveCount(0);
	}
}

//---------------------------------------------------------
// 1-3. The three non-resolved situations
//---------------------------------------------------------
// Each renders its OWN terminal state. Collapsing them was the second half of
// the defect: a security denial that reads "Not available on this instance"
// tells the operator the product lacks a feature it actually has.

test('denied (403) — gateway-only nav is withdrawn and the page says permission, not absence', async ({page, consoleGuard}) => {
	allowProbeNoise(consoleGuard);
	const probes = {n: 0};
	await page.route(VERSION_URL, probeAnswers(403, probes));

	await page.goto(`instance/dashboard?name=${instName}`, {waitUntil: 'domcontentloaded'});
	await expectNarrowNav(page);

	// A direct URL hit is the path that bypasses the navigation entirely.
	await page.goto(`instance/ai/apikey?name=${instName}`, {waitUntil: 'domcontentloaded'});
	await expect(page.getByTestId('flavor-denied')).toBeVisible({timeout: 20_000});
	await expect(page.getByText('Permission denied')).toBeVisible();
	// The three wrong answers, each named so a regression reports which one it gave.
	await expect(page.getByText('Not available on this instance'), 'a denial must not be reported as a missing feature').toHaveCount(0);
	// Toolbar buttons are icon-only (helpers/table.ts) — located by icon testid.
	await expect(toolbarButton(page, 'Add'), 'no gateway-only write control may render').toHaveCount(0);
	await expect(page.getByTestId('flavor-loading'), 'a denial must not spin forever').toHaveCount(0);
});

test('denied is never retried — a refused probe must not hammer the instance', async ({page, consoleGuard}) => {
	allowProbeNoise(consoleGuard);
	const probes = {n: 0};
	await page.route(VERSION_URL, probeAnswers(403, probes));

	await page.goto(`instance/ai/apikey?name=${instName}`, {waitUntil: 'domcontentloaded'});
	await expect(page.getByTestId('flavor-denied')).toBeVisible({timeout: 20_000});

	// Outlast the retry schedule the transport/5xx path uses (two retries,
	// ~1s then ~2s). If the denial were retried, the count would climb here.
	// It must not: an auth denial cannot self-heal, and retrying it pressures
	// the OAM login rate limiter that the whole suite shares.
	const afterFirstRender = probes.n;
	await page.waitForTimeout(6_000);
	expect(probes.n, 'a 403 capability probe was retried').toBe(afterFirstRender);
	expect(afterFirstRender, 'the probe should be asked once, not per consumer').toBeLessThanOrEqual(2);
});

test('unavailable (5xx, retries exhausted) — reads as unreachable, not as a narrower product', async ({page, consoleGuard}) => {
	allowProbeNoise(consoleGuard);
	const probes = {n: 0};
	await page.route(VERSION_URL, probeAnswers(503, probes));

	await page.goto(`instance/ipsec/tunnels?name=${instName}`, {waitUntil: 'domcontentloaded'});
	// Two retries at ~1s/~2s have to play out before react-query calls it.
	await expect(page.getByTestId('flavor-unavailable')).toBeVisible({timeout: 45_000});
	await expect(page.getByText('Instance unreachable')).toBeVisible();
	await expect(page.getByText('Not available on this instance'), 'unreachable must not be reported as a missing feature').toHaveCount(0);
	expect(probes.n, 'a 5xx probe should be retried before giving up').toBeGreaterThan(1);
});

test('loading — the broad surface is withheld WHILE the probe is in flight', async ({page, consoleGuard}) => {
	// The original defect in its purest form. `flavor ?? "inference-gateway"`
	// made this window indistinguishable from a resolved gateway, so the
	// gateway menu flashed up on every page load and stayed up forever if the
	// probe never resolved.
	allowProbeNoise(consoleGuard);
	const probes = {n: 0};
	await page.route(VERSION_URL, probeHangs(probes));

	await page.goto(`instance/dashboard?name=${instName}`, {waitUntil: 'domcontentloaded'});
	await expectNarrowNav(page);

	await page.goto(`instance/ai/apikey?name=${instName}`, {waitUntil: 'domcontentloaded'});
	await expect(page.getByTestId('flavor-loading')).toBeVisible({timeout: 20_000});
	await expect(page.getByText('Detecting instance capabilities…')).toBeVisible();
	await expect(toolbarButton(page, 'Add'), 'no gateway-only write control may render mid-probe').toHaveCount(0);

	// Still nothing after a window several times the probe's normal latency:
	// the surface is withheld for as long as the answer is unknown, it does
	// not merely arrive late.
	await page.waitForTimeout(5_000);
	await expect(page.getByTestId('flavor-loading')).toBeVisible();
	expect(probes.n, 'the probe must actually have been attempted').toBeGreaterThan(0);
});

//---------------------------------------------------------
// 4. The control
//---------------------------------------------------------
// Without this, every assertion above could be satisfied by a UI that simply
// never shows the AI menu. This is the case that makes the file honest.

test('control: the SAME assertions invert on a resolved gateway — the surface is really there', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);

	await page.goto(`instance/dashboard?name=${instName}`, {waitUntil: 'domcontentloaded'});
	for (const group of [...SHARED_GROUPS, ...GATEWAY_ONLY_GROUPS]) {
		await expect(drawer(page).getByText(group, {exact: true}), `${group} must be offered on a resolved gateway`).toBeVisible({timeout: 30_000});
	}

	await page.goto(`instance/ai/apikey?name=${instName}`, {waitUntil: 'domcontentloaded'});
	// The real page, not any of the three guard states.
	await expect(page.getByTestId('flavor-denied')).toHaveCount(0);
	await expect(page.getByTestId('flavor-unavailable')).toHaveCount(0);
	await expect(page.getByText('Not available on this instance')).toHaveCount(0);
	await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible({timeout: 30_000});
});
