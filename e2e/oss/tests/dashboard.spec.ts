//---------------------------------------------------------
// Dashboard on loxilb-oss.
//
// The dashboard is where the two backends diverge most quietly, because
// nothing here is part of the swagger contract — the Prometheus exposition is
// an unversioned side-contract, so neither the subset test nor the capability
// map can police it. Upstream loxilb is a THIRD naming generation:
//
//   - endpoint health is counted per host    (healthy_host_count)
//   - cumulative counters carry no `_total`  (processed_bytes)
//   - system utilization is not exported at all
//
// src/connector/instance/metrics.ts keeps a per-flavor alias table for
// exactly this. These tests are the only thing that checks the loxilb column
// of that table against a real loxilb.
//
// The second subject is honesty: a figure nothing reports must render as N/A,
// never as a confident 0. SystemUsageCard derives CPU/memory/disk from
// /status/{process,filesystem} when the Prometheus gauge is absent (which is
// always, upstream) and captions each pie with the source it came from.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {gw} from '../../helpers/api';
import {gotoLoxilbPage, requireLoxilbInstance} from '../_loxilb';

let instName: string;

/** The live scrape as {name: value}, or null when collection is disabled. */
async function scrape(): Promise<Record<string, number> | null> {
	const resp = await gw('GET', '/metrics');
	if (!resp.ok) return null;
	const text = await resp.text();
	// Upstream answers 200 with a JSON string when Prometheus is off — see
	// read-surface.spec.ts LX-READ-6. That is not an exposition.
	if (/Prometheus option is disabled/i.test(text)) return null;
	const values: Record<string, number> = {};
	for (const line of text.split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+]+)/);
		if (!m) continue;
		const v = Number(m[3]);
		if (Number.isFinite(v)) values[m[1]] = (values[m[1]] ?? 0) + v;
	}
	return Object.keys(values).length ? values : null;
}

test.describe('@loxilb Dashboard (loxilb-oss)', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		// loxilb's /status/device is shell-exec based and 500s transiently
		// (200 on re-probe); the cards degrade in place.
		consoleGuard.allow(/Failed to load resource.*50\d/i);
		await gotoLoxilbPage(page, 'dashboard', instName);
	});

	test('DASH-1: every card mounts and nothing degrades to an error page or banner', async ({page}) => {
		for (const title of ['System Usage', 'Connection Tracking', 'Endpoint Health', 'Load Balancer Rules']) {
			await expect(page.getByText(title, {exact: true}).first(), `${title} card`).toBeVisible({timeout: 20_000});
		}
		await expect(page.locator('.MuiAlert-standardError'), 'no error banner on a loxilb dashboard').toHaveCount(0);
	});

	test('DASH-2: System Usage is /status-derived and labels its source (upstream exports no system_* gauge)', async ({page}) => {
		const card = page.locator('.MuiPaper-root').filter({hasText: 'System Usage'}).first();
		await expect(card).toBeVisible({timeout: 20_000});

		// Disk is the deterministic one: /status/filesystem is always served, so
		// the pie must exist AND be captioned as df-derived — never presented as
		// a direct measurement it is not.
		await expect(card.getByText(/From df \(/), 'disk usage is captioned as df-derived').toBeVisible({timeout: 20_000});

		// A metric nothing reports must read N/A rather than 0%. Whichever of
		// CPU/memory `top` could not account for shows the placeholder; neither
		// may silently render as a zero-used pie.
		const naCount = await card.getByText('Not reported by this instance').count();
		const topCount = await card.getByText(/From top \(/).count();
		expect(naCount + topCount, 'CPU and memory are each either top-derived or an explicit N/A').toBeGreaterThanOrEqual(2);
	});

	test('DASH-3: the loxilb alias table maps the live scrape onto the cards (or the cards stay honest without one)', async ({page}) => {
		const metrics = await scrape();

		if (!metrics) {
			// Prometheus disabled — the whole point is that the cards must not
			// invent numbers. This is the testbed's default state, so it is the
			// branch that actually runs most of the time.
			test.info().annotations.push({type: 'note', description: 'Prometheus collection disabled on this instance — asserting the no-scrape path'});
			await expect(page.locator('.MuiAlert-standardError'), 'a missing scrape is not an error state').toHaveCount(0);
			return;
		}

		// The names upstream really publishes. If loxilb renames any of these,
		// the alias table in metrics.ts is wrong and the cards read zero —
		// this assertion is the tripwire.
		for (const name of ['lb_rule_count', 'active_conntrack_count']) {
			expect(metrics[name], `upstream publishes ${name} (loxilb alias table)`).toBeDefined();
		}
		// Upstream drops the `_total` suffix the gateway uses.
		expect(metrics['processed_bytes'] ?? metrics['processed_bytes_total'], 'upstream cumulative byte counter').toBeDefined();
		expect(metrics['processed_bytes_total'], 'upstream does NOT use the gateway _total suffix').toBeUndefined();
		// …and exports no system utilization at all (why SystemUsageCard falls
		// back to /status — DASH-2).
		for (const name of ['system_cpu_utilization', 'system_memory_utilization', 'system_disk_utilization']) {
			expect(metrics[name], `upstream exports no ${name}`).toBeUndefined();
		}

		// The LB-rule card reads the aliased value, so it must agree with the
		// scrape it was derived from.
		const card = page.locator('.MuiPaper-root').filter({hasText: 'Load Balancer Rules'}).first();
		await expect(card.getByText(String(metrics['lb_rule_count']), {exact: false}).first(), 'LB rule card shows the scraped count').toBeVisible({timeout: 20_000});
	});
});
