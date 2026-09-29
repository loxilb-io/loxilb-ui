import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {WORKER_SCRAPE, workerScrape} from './workerScrape';

const T0 = 1_700_000_000_000;
const T1 = T0 + 10_000;
const GAP = 35_000;

function snapshotOf(text: string, receivedAtMs: number, failure?: IMetricsSnapshot['failure']): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, failure, families: parsed.families, diagnostics: parsed.diagnostics};
}

// The gateway pre-creates all seven children at zero (ai_metrics.go init),
// so a realistic fixture always carries every one of them.
const RESULTS = ['ok', 'unparseable', 'unreachable', 'http_error', 'body_error', 'bad_request', 'unknown'] as const;
type Counts = Partial<Record<(typeof RESULTS)[number], number>>;
const exposition = (c: Counts, omit: readonly string[] = []) =>
	RESULTS.filter(r => !omit.includes(r))
		.map(r => `${WORKER_SCRAPE}{result="${r}"} ${c[r] ?? 0}`)
		.join('\n');
const at = (c: Counts, t: number) => snapshotOf(exposition(c), t);

describe('workerScrape', () => {
	it('is unavailable without a snapshot, on a failed scrape, or without the family', () => {
		expect(workerScrape(undefined, [], GAP)).toEqual({kind: 'unavailable'});
		const failed = snapshotOf(exposition({ok: 1}), T1, {status: 'unavailable', code: 'metrics.scrape', localeKey: 'status.unavailable', retryable: true});
		expect(workerScrape(failed, [failed], GAP)).toEqual({kind: 'unavailable'});
		const other = snapshotOf('loxilb_pd_sessions_active 0', T1);
		expect(workerScrape(other, [other], GAP)).toEqual({kind: 'unavailable'});
	});

	it('reads the pre-created all-zero vector as idle — no P/D rule runs the scraper', () => {
		const s = at({}, T1);
		expect(workerScrape(s, [s], GAP)).toEqual({kind: 'idle'});
	});

	it('⭐⭐ reports never-ok from lifetime totals alone, with no window needed', () => {
		// The live testbed: unparseable 39150, ok 0. One observation suffices —
		// "never parsed" needs no rate.
		const s = at({unparseable: 39150}, T1);
		expect(workerScrape(s, [], GAP)).toEqual({kind: 'never-ok', attempts: 39150});
	});

	it('⭐ withholds the verdict when the ok child is missing, rather than reading it as zero', () => {
		// Absent is not zero: without the ok child "never parsed" is unproven.
		const s = snapshotOf(exposition({unparseable: 5}, ['ok']), T1);
		expect(workerScrape(s, [s], GAP)).toEqual({kind: 'pending'});
	});

	it('reports the failed share of attempts in the window', () => {
		const history = [at({ok: 100, unreachable: 2}, T0), at({ok: 130, unreachable: 7, unparseable: 5}, T1)];
		// 30 ok + 5 unreachable + 5 unparseable = 40 attempts, 10 failed.
		expect(workerScrape(history[1], history, GAP)).toEqual({kind: 'failing', failedShare: 0.25});
	});

	it('is healthy when every attempt in the window parsed', () => {
		const history = [at({ok: 100, http_error: 3}, T0), at({ok: 130, http_error: 3}, T1)];
		// Past failures before the window do not keep it failing.
		expect(workerScrape(history[1], history, GAP)).toEqual({kind: 'healthy'});
	});

	it('does not call a quiet window a failure', () => {
		// Rules idle for the window: no attempts is not a failed attempt.
		const history = [at({ok: 100}, T0), at({ok: 100}, T1)];
		expect(workerScrape(history[1], history, GAP)).toEqual({kind: 'healthy'});
	});

	it('is pending on a first observation, and after a counter reset', () => {
		const s = at({ok: 100}, T1);
		expect(workerScrape(s, [s], GAP)).toEqual({kind: 'pending'});
		const reset = [at({ok: 500, unparseable: 9}, T0), at({ok: 3, unparseable: 1}, T1)];
		expect(workerScrape(reset[1], reset, GAP)).toEqual({kind: 'pending'});
	});
});
