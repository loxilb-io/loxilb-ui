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
//  - /logs upstream returns {logs} ONLY — no next_cursor/has_more/total_size.
//    The log console must degrade to a single page rather than render a
//    pagination control that can never advance.
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

	test('LX-READ-5: /logs has no cursor pagination upstream, and the console degrades to one page', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource.*50\d/i);

		const logs = await gwJson<Record<string, unknown>>('/logs?limit=5');
		expect(logs, '/logs returns a log list').toHaveProperty('logs');
		// The gateway-only pagination envelope. If upstream ever adds these,
		// this test failing is the signal to drop the degradation path — not a
		// regression.
		for (const field of ['next_cursor', 'has_more', 'total_size']) {
			expect(logs[field], `/logs upstream does not carry ${field}`).toBeUndefined();
		}

		// Consequence in the UI: no "load older lines" button, because a cursor
		// it cannot send would produce a control that never advances.
		await gotoLoxilbPage(page, 'status/logs', instName);
		await expect(page.getByRole('button', {name: /Load older lines/i}), 'no dead pagination control on loxilb').toHaveCount(0);
		await expect(page.getByText(/load more to search further back/i), 'no "load more" hint on loxilb').toHaveCount(0);
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
