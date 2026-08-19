//---------------------------------------------------------
// LX-READ — the upstream read APIs this UI depends on.
//
// Everything here is a contract the UI silently relies on, where a change
// upstream shows up in the browser as a blank card or a dead control rather
// than an error. Asserting the API shape directly turns those into a named
// failure with an obvious owner.
//
// It also pins the three asymmetries that are easy to "fix" wrongly later:
//
//  - /config/export + /config/import DO exist upstream, even though the
//    Snapshots page is flavor-gated off. The gate is about persist/restore
//    (gateway-only) and about neither swagger declaring the snapshot family,
//    NOT about export being missing. Someone re-reading the gate without this
//    test would reasonably conclude loxilb has no export at all.
//  - /logs pagination is VERSION-DEPENDENT upstream, not absent. Released
//    loxilb (through v0.9.8.6) returns {logs} only and the console degrades to
//    a single page; newer builds serve the same next_cursor/has_more/total_size
//    envelope as the gateway and the console pages like it does. LX-READ-5
//    below asserts whichever one the pinned build actually implements, because
//    pinning either as the invariant makes the suite red on the other.
//  - /metrics answers 200 with a plain string when Prometheus is disabled
//    (NOT 503 like the gateway), so "200" alone is not proof of an exposition.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {gw, gwJson} from '../../helpers/api';
import {gotoLoxilbPage, requireLoxilbInstance} from '../_loxilb';

let instName: string;

test.describe('@loxilb LX-READ — upstream read surface the UI depends on', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
	});

	test('LX-READ-1: /meta serves the form metadata, including the enum sets the LB form validates against', async () => {
		// hooks/inputFormHook.ts validates against metadata fetched from the
		// instance at runtime. If loxilb ever stopped serving /meta compatibly,
		// every generated form would quietly lose its client-side validation.
		const meta = await gwJson<Record<string, any>>('/meta');
		const text = JSON.stringify(meta);
		expect(Object.keys(meta).length, '/meta is not empty').toBeGreaterThan(0);
		expect(text, '/meta describes the LB service arguments').toContain('serviceArguments');
		// The enums the form turns into dropdowns.
		expect(text, '/meta carries enum metadata').toContain('enum');
	});

	test('LX-READ-2: /config/params serves the log-level knob the settings page reads', async () => {
		const params = await gwJson<Record<string, unknown>>('/config/params');
		expect(Object.keys(params).length, '/config/params returns a config object').toBeGreaterThan(0);
	});

	test('LX-READ-3: /config/cistate/all serves the HA state the status page renders', async () => {
		const cistate = await gwJson<Record<string, any>>('/config/cistate/all');
		// Key name is the contract; its value varies with the box's HA role.
		expect(Object.keys(cistate).join(','), 'cistate payload shape').toMatch(/Attr|ciStateAttr/i);
	});

	test('LX-READ-4: /config/export exists upstream even though Snapshots is gated off', async () => {
		// See the header: the gate is about persist/restore + undeclared specs,
		// not about export being absent. Keep both halves asserted together so
		// the reason survives.
		const exported = await gw('GET', '/config/export');
		expect(exported.status, 'upstream loxilb serves GET /config/export').toBe(200);
		expect((await exported.text()).length, 'export returns a real config dump').toBeGreaterThan(0);

		// …and persist/restore genuinely are gateway-only.
		const persist = await gw('POST', '/config/persist', {});
		expect(persist.status, 'persist is gateway-only').toBe(404);
	});

	test('LX-READ-5: /logs pages by cursor when the build supports it, and the console control matches', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource.*50\d/i);

		// A 5-line window is smaller than any log this testbed keeps, so `has_more`
		// here reports the BUILD's capability rather than how big today's file
		// happens to be. Asking for the page's default 1000 would conflate the two.
		const first = await gwJson<Record<string, any>>('/logs?lines=5');
		expect(first, '/logs returns a log list').toHaveProperty('logs');

		const paginates = ['next_cursor', 'has_more', 'total_size'].some(f => first[f] !== undefined);

		if (!paginates) {
			// Released loxilb: {logs} and nothing else. Assert all three together so
			// a build that grows only half an envelope is a failure, not a silent
			// half-working pager.
			for (const field of ['next_cursor', 'has_more', 'total_size']) {
				expect(first[field], `/logs on this build does not carry ${field}`).toBeUndefined();
			}
		} else {
			// Newer upstream build: the envelope must be COMPLETE, not merely
			// present. `has_more` without a cursor to follow is precisely the dead
			// control the degradation path existed to avoid.
			expect(first.has_more, '5 lines cannot be the whole log').toBe(true);
			expect(typeof first.next_cursor, 'has_more:true must come with a cursor to follow').toBe('string');
			expect(String(first.next_cursor).length, 'the cursor is not empty').toBeGreaterThan(0);
			expect(typeof first.total_size, 'total_size sizes the scan the console reports').toBe('number');

			// …and the cursor has to advance. One that re-serves its own page turns
			// "Load older lines" into a button that runs forever without progressing,
			// which reads as working right up until someone counts the lines.
			const second = await gwJson<Record<string, any>>(`/logs?lines=5&cursor=${encodeURIComponent(first.next_cursor)}`);
			expect(second.logs, 'following the cursor returns lines').not.toHaveLength(0);
			expect(second.logs, 'following the cursor moves off the first page').not.toEqual(first.logs);
		}

		// The UI consequence. The console asks for 1000 lines, so whether it can
		// page further is a property of THIS log file, not of the backend — read
		// the page's own response instead of re-deriving it from the probe above,
		// which used a deliberately different window.
		// Scoped to the OAM proxy path on purpose: the SPA route for this page is
		// itself `.../status/logs?name=…`, so a bare /logs\? matches the document
		// navigation and hands back HTML instead of the API response.
		const firstPage = page.waitForResponse(r => /\/netlox\/v1\/logs\?/.test(r.url()) && r.ok(), {timeout: 30_000});
		await gotoLoxilbPage(page, 'status/logs', instName);
		const body = await (await firstPage).json();
		const loadedCount = async () => Number(/\d+/.exec(await page.getByText(/Filtering \d+ loaded lines/).innerText())![0]);
		await expect(page.getByText(/Filtering \d+ loaded lines/)).toBeVisible({timeout: 30_000});

		const loadMore = page.getByRole('button', {name: /Load older lines/i});
		if (body.has_more) {
			await expect(loadMore, 'has_more:true must offer a way to reach the rest').toBeVisible();
			const before = await loadedCount();
			await loadMore.click();
			// Rows must actually accumulate. The button rendering is not the
			// contract; more lines on screen is.
			await expect.poll(loadedCount, {timeout: 30_000}).toBeGreaterThan(before);
		} else {
			// Either the build has no cursor at all, or this file fits in one page.
			// Both must present the same thing: no control that cannot advance.
			await expect(loadMore, 'nothing further to load — no dead pagination control').toHaveCount(0);
			await expect(page.getByText(/load more to search further back/i), 'no "load more" hint either').toHaveCount(0);
		}
	});

	test('LX-READ-6: /metrics answers 200 even when Prometheus is off, so the parser must not trust the status alone', async () => {
		// Upstream returns 200 with the JSON string "Prometheus option is
		// disabled." — the gateway returns 503 for the same condition. The
		// metrics connector parses any 200 body as an exposition, which yields
		// an EMPTY snapshot here rather than garbage; that is what keeps the
		// dashboard cards on honest placeholders (see dashboard.spec.ts).
		const resp = await gw('GET', '/metrics');
		expect(resp.status, '/metrics is reachable').toBe(200);
		const body = await resp.text();
		const isExposition = /^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+-?[0-9.eE+]+$/m.test(body);
		const isDisabledNotice = /Prometheus option is disabled/i.test(body);
		expect(isExposition || isDisabledNotice, `/metrics is either an exposition or the disabled notice, got: ${body.slice(0, 120)}`).toBe(true);
	});

	test('LX-READ-7: the gateway-only endpoint families really are absent (the premise of every gate)', async () => {
		// The flavor gates in the UI are only correct if these 404. Asserting it
		// here means a loxilb build that ADDS one of these families fails a
		// named test instead of leaving a page needlessly hidden.
		for (const path of ['/config/ipfilter/all', '/config/securityrate', '/config/ipsec/tunnels/all', '/config/ipv6address/all', '/config/ai/apikey', '/config/trace/status', '/sni/certificates']) {
			const resp = await gw('GET', path);
			expect(resp.status, `${path} is gateway-only`).toBe(404);
		}
	});
});
