//---------------------------------------------------------
// UI-P6-5 state matrix (ES-10 / ES-14) — what a page shows, in a browser.
//
// The unit suites pin the rendering of a state that is handed to a component.
// This pins the thing that actually matters to an operator: that a real read,
// failing in a real browser, reaches that rendering — through the connector's
// assertOk, react-query's error state, the page, the table wrapper, and
// DataTable — instead of arriving as a successful empty resource.
//
// Every case injects its failure by route interception, so nothing on the
// testbed is mutated and each case reproduces identically forever.
//
// Two notes on the choice of status codes:
//   - 401 is used ONLY on gateway pass-through reads. On an OAM route a 401
//     is the operator's session ending (UI-P6-4 tears the app down and every
//     later spec in the run would fail on a revoked token); the management-hop
//     carve-out is what makes it safe here. OAM reads use 403 for the denied
//     case instead, which maps to the same state without the teardown.
//   - `abort` stands for the transport failing outright — no HTTP response at
//     all — which is the one case a status code cannot express.
//---------------------------------------------------------
import {Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

let instName = '';

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

// How long a FAILURE state is allowed to take to appear. Two delays stack:
// the page does not issue its read until the /version capability probe has
// resolved, and react-query then retries a failed read three times, three
// seconds apart, before it reports an error (hooks/query/common.ts). Both are
// real product behaviour — an operator genuinely waits them out — so these
// assertions have to outlast them rather than race them.
//
// Sized against the WAN, not against a good day. At 10 s and again at 25 s,
// cases failed on a snapshot still reading "Loading …" while the testbed was
// slow, and passed in isolation minutes later: a bound tight enough to depend
// on link latency reports the environment, not the product. The per-test
// timeout is 120 s, so this stays well inside it.
const AFTER_RETRIES = 60_000;

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

/** Answer a read with `status`. Preflight is answered too — the OAM is cross-origin. */
function readAnswers(status: number, body: string) {
	return async (route: Route) => {
		if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
		if (route.request().method() !== 'GET') return route.continue();
		return route.fulfill({status, headers: {...CORS, 'Content-Type': 'application/json'}, body});
	};
}

/** The transport dies: no response, no status. */
function readAborts() {
	return async (route: Route) => {
		if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
		if (route.request().method() !== 'GET') return route.continue();
		return route.abort('failed');
	};
}

/** A deliberately broken read is loud in the console; that noise is the point, not a defect. */
function allowFailedReadNoise(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of (4\d\d|5\d\d)/i);
	consoleGuard.allow(/net::ERR_FAILED/);
	consoleGuard.allow(/Failed to fetch/i);
	consoleGuard.allow(/Network request failed/i);
}

//---------------------------------------------------------
// 1. All four states, on one representative page
//---------------------------------------------------------
// Load Balancer: a gateway pass-through read, a table with the full set of
// write buttons, and the family an operator is most likely to be looking at
// when something breaks.
const LB_URL = '**/netlox/v1/config/loadbalancer/all';
const lbPage = () => `instance/traffic/lb?name=${instName}`;

const EMPTY_SENTENCE = /No Load Balancer entries yet/i;

// A synthetic rule, served by interception only — never written to the
// testbed. Its name is what the stale case looks for on screen.
const STALE_RULE = {
	serviceArguments: {name: 'e2e-page-state-stale', externalIP: '203.0.113.9', port: 8080, protocol: 'tcp', sel: 0, mode: 0},
	endpoints: [],
};

test.describe('the four states, end to end on the Load Balancer page', () => {
	test('empty 200 — says the resource is empty, with no error styling and writes available', async ({page, consoleGuard}) => {
		await page.route(LB_URL, readAnswers(200, JSON.stringify({lbAttr: []})));
		await page.goto(lbPage());

		// The sentence appears TWICE by design and neither copy is redundant:
		// the grid's overlay shows it where the rows would be, and a
		// visually-hidden live region outside the grid announces it. They
		// cannot be merged — role="grid" forbids a role="status" child, which
		// is the aria-required-children violation the first cut shipped.
		await expect(page.getByRole('status').filter({hasText: EMPTY_SENTENCE})).toBeVisible();
		await expect(page.getByRole('grid').getByText(EMPTY_SENTENCE)).toBeVisible();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(page.getByRole('button', {name: `Add Load Balancer`})).toBeEnabled();
		expect(consoleGuard.violations()).toEqual([]);
	});

	test('500 — the failure is stated and the empty table is NOT drawn', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		await page.route(LB_URL, readAnswers(500, JSON.stringify({message: 'boom on node-3'})));
		await page.goto(lbPage());

		await expect(page.getByRole('alert')).toBeVisible({timeout: AFTER_RETRIES});
		// The whole point of the task: an error is never an empty resource.
		await expect(page.getByText(EMPTY_SENTENCE)).toHaveCount(0);
		// Raw server prose must not reach the screen (ES-15).
		await expect(page.getByText(/boom on node-3/)).toHaveCount(0);
	});

	test('500 — the row-targeted actions are held, but creating is still possible', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		await page.route(LB_URL, readAnswers(500, JSON.stringify({message: 'boom'})));
		await page.goto(lbPage());

		await expect(page.getByRole('alert')).toBeVisible({timeout: AFTER_RETRIES});

		// Edit and Delete target a selected row, and there are no rows we can
		// vouch for.
		await expect(page.getByRole('button', {name: 'Edit Load Balancer'})).toBeDisabled();
		await expect(page.getByRole('button', {name: 'Delete Load Balancer'})).toBeDisabled();

		// Add does not. This assertion was the other way round in the first
		// cut, and the full run proved it wrong: on an instance whose list
		// answers 403 because a feature is off, creating is exactly what the
		// operator still needs to do (cicd/ha/bgp-neighbor.spec.ts). Only
		// `stale` bars creation — see the stale case below.
		await expect(page.getByRole('button', {name: 'Add Load Balancer'})).toBeEnabled();
	});

	test('403 — reads as a permission problem, not as a server error or an empty table', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		await page.route(LB_URL, readAnswers(403, JSON.stringify({message: 'no'})));
		await page.goto(lbPage());

		await expect(page.getByText(/permission to view/i)).toBeVisible({timeout: AFTER_RETRIES});
		await expect(page.getByText(EMPTY_SENTENCE)).toHaveCount(0);
		// Retrying a permission failure cannot help, so it is not offered.
		await expect(page.getByRole('button', {name: /^Retry$/})).toHaveCount(0);
	});

	test('a gateway-origin 401 renders denied in the page and does NOT end the OAM session', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		// The carve-out is header-based, not URL-based (fetcher_base
		// `shouldExpireOAMSession`): a 401 is the operator's OAM session ending
		// UNLESS the OAM marks it as relayed from the gateway. The first cut of
		// this case sent a bare 401 on a pass-through URL and was signed out —
		// correctly. The header has to be EXPOSED too, or the browser hides it
		// from the page on a cross-origin response and the app sees a bare 401.
		await page.route(LB_URL, async route => {
			if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
			if (route.request().method() !== 'GET') return route.continue();
			return route.fulfill({
				status: 401,
				headers: {
					...CORS,
					'Access-Control-Expose-Headers': 'X-Loxi-Error-Origin',
					'X-Loxi-Error-Origin': 'gateway',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({message: 'gateway says no'}),
			});
		});
		await page.goto(lbPage());

		await expect(page.getByText(/permission to view/i)).toBeVisible({timeout: AFTER_RETRIES});
		// The management hop refusing us is not the human's session ending.
		await expect(page.getByText(/Your session ended/i)).toHaveCount(0);
		expect(page.url()).not.toMatch(/\/login/);
	});

	test('transport aborted — reads as temporarily unavailable, and offers a retry', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		await page.route(LB_URL, readAborts());
		await page.goto(lbPage());

		await expect(page.getByText(/temporarily unavailable/i)).toBeVisible({timeout: AFTER_RETRIES});
		await expect(page.getByText(EMPTY_SENTENCE)).toHaveCount(0);
		await expect(page.getByRole('button', {name: /^Retry$/})).toBeVisible();
	});

	test('stale — rows survive a failed refresh, are labelled out of date, and cannot be acted on', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);

		// Both phases are served by interception, so the case does not depend on
		// the testbed happening to hold LB rules. It did, on the first run: the
		// list was empty, "rows survive" compared 0 to 0, and the assertion
		// would have passed without the behaviour existing.
		let served = 0;
		await page.route(LB_URL, async route => {
			if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
			if (route.request().method() !== 'GET') return route.continue();
			served += 1;
			// First read succeeds; everything after it fails.
			if (served === 1) {
				return route.fulfill({
					status: 200,
					headers: {...CORS, 'Content-Type': 'application/json'},
					body: JSON.stringify({lbAttr: [STALE_RULE]}),
				});
			}
			return route.fulfill({status: 503, headers: {...CORS, 'Content-Type': 'application/json'}, body: '{}'});
		});

		await page.goto(lbPage());
		// The Add button only exists once /version has resolved the write
		// contract (LBRulePage withholds it while unresolved), so wait for the
		// row rather than for the toolbar.
		await expect(page.getByText(STALE_RULE.serviceArguments.name, {exact: true})).toBeVisible({timeout: AFTER_RETRIES});
		const rowsBefore = await page.locator('.MuiDataGrid-row').count();
		expect(rowsBefore, 'phase 1 must put a row on screen for phase 2 to preserve').toBeGreaterThan(0);

		// Phase 2: the refresh fails over rows that are already on screen.
		await page.getByRole('button', {name: 'Refresh Load Balancer'}).click();

		await expect(page.getByText(/Out of date/i).first()).toBeVisible({timeout: AFTER_RETRIES});
		// Still readable — stale data is worth looking at.
		expect(await page.locator('.MuiDataGrid-row').count()).toBe(rowsBefore);
		// Never actionable: we know neither that these rows match the server
		// nor that this operator is still authorized.
		await expect(page.getByRole('button', {name: 'Delete Load Balancer'})).toBeDisabled();
		const add = page.getByRole('button', {name: 'Add Load Balancer'});
		if (await add.count()) await expect(add).toBeDisabled();
	});

	test('recovering — a retry that succeeds clears the banner', async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		let failNext = true;
		// Fail every read until the operator presses Retry, then serve a real
		// list. `failNext` flips on the click, not on the first response: the
		// three automatic retries would otherwise consume the failure before
		// the banner had been on screen long enough to press anything.
		await page.route(LB_URL, async route => {
			if (route.request().method() === 'OPTIONS') return route.fulfill({status: 204, headers: CORS});
			if (route.request().method() !== 'GET') return route.continue();
			if (!failNext) {
				return route.fulfill({
					status: 200,
					headers: {...CORS, 'Content-Type': 'application/json'},
					body: JSON.stringify({lbAttr: [STALE_RULE]}),
				});
			}
			return route.fulfill({status: 503, headers: {...CORS, 'Content-Type': 'application/json'}, body: '{}'});
		});

		await page.goto(lbPage());
		await expect(page.getByText(/temporarily unavailable/i)).toBeVisible({timeout: AFTER_RETRIES});

		failNext = false;
		await page.getByRole('button', {name: /^Retry$/}).click();

		await expect(page.getByText(/temporarily unavailable/i)).toHaveCount(0, {timeout: AFTER_RETRIES});
		// `exact` matters: DataTable's id column renders the whole rule identity,
		// which embeds the name, so a substring match resolves to two elements.
		await expect(page.getByText(STALE_RULE.serviceArguments.name, {exact: true})).toBeVisible();
	});
});

//---------------------------------------------------------
// 2. The sweep: no family renders a failed read as an empty table
//---------------------------------------------------------
// One representative page per family, each answered 500. The assertion is
// the exit-checklist line itself, and it is deliberately the same assertion
// for every family — the whole value of a shared vocabulary is that no page
// gets to be the exception.
const FAMILIES: {family: string; route: string; url: string; empty: RegExp}[] = [
	{family: 'status', route: '**/netlox/v1/status/filesystem', url: 'instance/status/fs', empty: /No File System entries yet/i},
	{family: 'network', route: '**/netlox/v1/config/vlan/all', url: 'instance/network/vlan', empty: /No VLAN entries yet/i},
	{family: 'endpoint', route: '**/netlox/v1/config/endpoint/all', url: 'instance/traffic/endpoint', empty: /No Endpoint entries yet/i},
	{family: 'conntrack', route: '**/netlox/v1/config/conntrack/all', url: 'instance/traffic/ct', empty: /No Connection Track entries yet/i},
	{family: 'qos', route: '**/netlox/v1/config/policy/all', url: 'instance/traffic/qos', empty: /No QoS entries yet/i},
	{family: 'firewall', route: '**/netlox/v1/config/firewall/all', url: 'instance/traffic/fw', empty: /No Firewall entries yet/i},
];

for (const {family, route, url, empty} of FAMILIES) {
	test(`sweep: ${family} — a 500 is never rendered as an empty table`, async ({page, consoleGuard}) => {
		allowFailedReadNoise(consoleGuard);
		await page.route(route, readAnswers(500, JSON.stringify({message: 'boom'})));
		await page.goto(`${url}?name=${instName}`);

		await expect(page.getByRole('alert')).toBeVisible({timeout: AFTER_RETRIES});
		await expect(page.getByText(empty)).toHaveCount(0);
	});
}

//---------------------------------------------------------
// 3. The instance landing page — the one screen with nothing to contradict it
//---------------------------------------------------------
test('instance list: a failed read does not render as "you have registered nothing"', async ({page, consoleGuard}) => {
	allowFailedReadNoise(consoleGuard);
	// 403, not 401: on an OAM route a 401 ends the session for the whole run.
	await page.route('**/oam/loxilbs', readAnswers(403, JSON.stringify({message: 'nope'})));
	await page.goto('instance');

	await expect(page.getByText(/permission to view/i)).toBeVisible({timeout: AFTER_RETRIES});
	await expect(page.getByText(/No instances are registered yet/i)).toHaveCount(0);
	// The Add card is withheld: it is unknown whether this operator may
	// register anything at all.
	await expect(page.getByText(/Add Instance/i)).toHaveCount(0);
});

test('instance list: a genuinely empty list still invites the operator to add one', async ({page, consoleGuard}) => {
	await page.route('**/oam/loxilbs', readAnswers(200, '[]'));
	await page.goto('instance');

	await expect(page.getByText(/No instances are registered yet/i)).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
	expect(consoleGuard.violations()).toEqual([]);
});

//---------------------------------------------------------
// 4. The app must stay where the operator is
//---------------------------------------------------------
// Before UI-P6-5 an OAM control-plane read answering 503 or 5xx ejected the
// whole application to a full-screen error page, discarding the operator's
// context. (The fixtures assert the same thing globally; this states it
// deliberately, so the guarantee has a test that is ABOUT it.)
test('a failing read leaves the operator on the page they were reading', async ({page, consoleGuard}) => {
	allowFailedReadNoise(consoleGuard);
	await page.route('**/oam/logs', readAnswers(503, JSON.stringify({message: 'maintenance'})));
	await page.goto('system');

	// role="status", not role="alert": 503 is `unavailable`, which is polite —
	// only a hard `failed` interrupts a screen reader. Asserting on the alert
	// role here failed while the correct banner was on screen, which is the
	// vocabulary doing its job.
	await expect(page.getByText(/temporarily unavailable/i)).toBeVisible({timeout: AFTER_RETRIES});
	expect(page.url()).toMatch(/\/system/);
	expect(page.url()).not.toMatch(/\/(404|500|503)(\?|$)/);
});
