import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {
	AI_REQUESTS,
	completedRequestRate,
	completedRequestRatesBy,
	hasOutcomePartition,
	isErrorStatus,
	requestOutcomes,
} from './aiRequests';

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs,
		available: true,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

const T0 = 1_000_000;
const T1 = T0 + 10_000;
const GAP = 35_000;

// Gateway 27680379+ : denials counted in the same family, split by outcome.
const NEW = (completed: number, denied: number) =>
	[
		`${AI_REQUESTS}{model="m",tenant="t",status="200",outcome="completed"} ${completed}`,
		`${AI_REQUESTS}{model="m",tenant="t",status="429",outcome="denied"} ${denied}`,
	].join('\n');

// Pre-27680379 : no outcome label, family is completed-only.
const OLD = (completed: number) => `${AI_REQUESTS}{model="m",tenant="t",status="200"} ${completed}`;

describe('AI request outcome partition', () => {
	it('detects the partition from the exposition, not from the vendored manifest', () => {
		expect(hasOutcomePartition(snapshotOf(NEW(10, 5), T0))).toBe(true);
		expect(hasOutcomePartition(snapshotOf(OLD(10), T0))).toBe(false);
		expect(hasOutcomePartition(undefined)).toBe(false);
		// A family that is absent entirely is not a partitioned family.
		expect(hasOutcomePartition(snapshotOf('loxilb_lb_rules 3', T0))).toBe(false);
	});

	it('excludes denials from the completed rate on a partitioned gateway', () => {
		// completed 100 -> 200 over 10s = 10/s. Denials also move (5 -> 105);
		// summing the family whole would report 20/s under a "completed" label.
		const history = [snapshotOf(NEW(100, 5), T0), snapshotOf(NEW(200, 105), T1)];
		expect(completedRequestRate(history, GAP)).toEqual({kind: 'ok', perSecond: 10, intervalMs: 10_000});
	});

	it('still counts the whole family on a gateway that predates the label', () => {
		const history = [snapshotOf(OLD(100), T0), snapshotOf(OLD(200), T1)];
		expect(completedRequestRate(history, GAP)).toEqual({kind: 'ok', perSecond: 10, intervalMs: 10_000});
	});

	it('keeps denied statuses out of the per-status completed breakdown', () => {
		const history = [snapshotOf(NEW(100, 5), T0), snapshotOf(NEW(200, 105), T1)];
		const byStatus = completedRequestRatesBy(history, ['status'], GAP);
		// 429 belongs to the denied partition and must not appear here at all —
		// otherwise the page shows a denial as a served response code.
		expect(byStatus.map(r => r.labels.status)).toEqual(['200']);
		expect(byStatus[0].rate).toEqual({kind: 'ok', perSecond: 10, intervalMs: 10_000});
	});

	it('reports insufficient samples rather than a number from one observation', () => {
		expect(completedRequestRate([snapshotOf(NEW(100, 5), T0)], GAP)).toEqual({kind: 'insufficient-samples'});
	});

	it('does not resurrect a stale partition when the instance changes shape mid-history', () => {
		// An instance upgraded between polls: the newest snapshot decides, so the
		// filter matches the exposition the arithmetic actually ran over.
		const history = [snapshotOf(OLD(100), T0), snapshotOf(NEW(200, 50), T1)];
		expect(hasOutcomePartition(history[history.length - 1])).toBe(true);
		// The older snapshot has no completed-labelled series, so the pair is
		// incomplete — reported as such instead of diffing against nothing.
		expect(completedRequestRate(history, GAP)).toEqual({kind: 'insufficient-samples'});
	});
});

//---------------------------------------------------------
// UI-MON-008 — offered load, denials, error ratio
//---------------------------------------------------------

// A partitioned exposition with an explicit failed-response series, so the
// error numerator has both of its halves (a gate denial AND a 5xx a backend
// answered) and a test can tell them apart.
const FULL = (completed: number, denied: number, failed: number) =>
	[
		`${AI_REQUESTS}{model="m",tenant="t",status="200",outcome="completed"} ${completed}`,
		`${AI_REQUESTS}{model="m",tenant="t",status="503",outcome="completed"} ${failed}`,
		`${AI_REQUESTS}{model="m",tenant="t",status="429",outcome="denied"} ${denied}`,
	].join('\n');

describe('isErrorStatus', () => {
	it('treats 4xx and 5xx as failures and 2xx/3xx as not', () => {
		expect(isErrorStatus('200')).toBe(false);
		expect(isErrorStatus('301')).toBe(false);
		expect(isErrorStatus('399')).toBe(false);
		expect(isErrorStatus('400')).toBe(true);
		expect(isErrorStatus('429')).toBe(true);
		expect(isErrorStatus('503')).toBe(true);
	});

	// A malformed status must understate errors rather than invent them. The
	// traps are specific: Number('') is 0 and parseInt('4xx') is 4, so a
	// looser parse would classify both as successes by accident rather than
	// by decision — and '  500  ' would become a real error on whitespace.
	it('never classifies a non-numeric status as an error', () => {
		expect(isErrorStatus(undefined)).toBe(false);
		expect(isErrorStatus('')).toBe(false);
		expect(isErrorStatus('4xx')).toBe(false);
		expect(isErrorStatus('unknown')).toBe(false);
		expect(isErrorStatus(' 500')).toBe(false);
		expect(isErrorStatus('5e2')).toBe(false);
	});
});

describe('requestOutcomes — the unpartitioned path', () => {
	// The whole point of the gate. On a gateway that predates the label the
	// family IS the completed count, so an unfiltered sum would be a completed
	// rate wearing a "total" caption — the exact claim the page's notice
	// exists to prevent. The page keeps the notice on this branch.
	it('refuses to derive totals on a gateway that predates the outcome label', () => {
		const history = [snapshotOf(OLD(100), T0), snapshotOf(OLD(200), T1)];
		expect(requestOutcomes(history, GAP)).toEqual({kind: 'unpartitioned'});
	});

	it('is unpartitioned with no snapshot at all rather than throwing', () => {
		expect(requestOutcomes([], GAP)).toEqual({kind: 'unpartitioned'});
	});

	// Detection reads the NEWEST snapshot, matching completedRequestRate: an
	// instance upgraded mid-history is partitioned from that poll on.
	it('follows the newest snapshot when the instance changes shape', () => {
		const history = [snapshotOf(NEW(100, 5), T0), snapshotOf(OLD(200), T1)];
		expect(requestOutcomes(history, GAP).kind).toBe('unpartitioned');
	});
});

describe('requestOutcomes — the partitioned path', () => {
	it('derives offered load as completed + denied, not as the completed rate', () => {
		// completed 100->200 (10/s), failed 10->20 (1/s), denied 5->105 (10/s).
		const history = [snapshotOf(FULL(100, 5, 10), T0), snapshotOf(FULL(200, 105, 20), T1)];
		const o = requestOutcomes(history, GAP);
		expect(o.kind).toBe('partitioned');
		if (o.kind !== 'partitioned') return;

		expect(o.completed).toEqual({kind: 'ok', perSecond: 11, intervalMs: 10_000}); // 200 + 503
		expect(o.denied).toEqual({kind: 'ok', perSecond: 10, intervalMs: 10_000});
		expect(o.failed).toEqual({kind: 'ok', perSecond: 1, intervalMs: 10_000});
		// Offered is the whole family: 21/s, which is NOT the completed rate.
		expect(o.offered).toEqual({kind: 'ok', perSecond: 21, intervalMs: 10_000});
		// Errors = denied (10/s) + failed (1/s) = 11/s over 21/s offered.
		expect(o.errorRatio).toEqual({kind: 'ok', ratio: 11 / 21});
	});

	// The absent-series case that would otherwise blank the panel forever: a
	// counter child exists only once incremented, so a gateway that has never
	// denied anything exports no denied series. That is a real 0/s, because
	// the family itself is present in both observations.
	it('reads a never-incremented denial partition as 0/s, not as warming up', () => {
		const NO_DENIALS = (completed: number) =>
			`${AI_REQUESTS}{model="m",tenant="t",status="200",outcome="completed"} ${completed}`;
		const history = [snapshotOf(NO_DENIALS(100), T0), snapshotOf(NO_DENIALS(200), T1)];
		const o = requestOutcomes(history, GAP);
		expect(o.kind).toBe('partitioned');
		if (o.kind !== 'partitioned') return;

		expect(o.denied).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(o.failed).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(o.offered).toEqual({kind: 'ok', perSecond: 10, intervalMs: 10_000});
		// A healthy gateway reads 0% errors, not "warming up".
		expect(o.errorRatio).toEqual({kind: 'ok', ratio: 0});
	});

	// The shape a real gateway actually exposes, taken from a live capture of
	// the testbed: the outcome partition IS present, several models sum into
	// the same series, tenant is the empty string, and there is NO denied
	// series anywhere because nothing has ever been refused. That last part is
	// the common case, not an edge case — which is why a never-incremented
	// partition has to read 0/s. Reading it as insufficient-samples would have
	// left the error ratio blank on the very gateway this was built for.
	it('handles the real live-capture shape: partitioned, multi-model, no denials yet', () => {
		const LIVE = (a: number, b: number) =>
			[
				`${AI_REQUESTS}{model="Qwen_Qwen3-0.6B",outcome="completed",status="200",tenant=""} ${a}`,
				`${AI_REQUESTS}{model="sse-test",outcome="completed",status="200",tenant=""} ${b}`,
			].join('\n');
		const history = [snapshotOf(LIVE(646, 168), T0), snapshotOf(LIVE(746, 188), T1)];
		const o = requestOutcomes(history, GAP);
		expect(o.kind).toBe('partitioned');
		if (o.kind !== 'partitioned') return;

		// Both models sum into offered load: (100 + 20) / 10s = 12/s.
		expect(o.offered).toEqual({kind: 'ok', perSecond: 12, intervalMs: 10_000});
		expect(o.completed).toEqual({kind: 'ok', perSecond: 12, intervalMs: 10_000});
		expect(o.denied).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(o.errorRatio).toEqual({kind: 'ok', ratio: 0});
	});

	// 0/0 is not 0%. An idle gateway has no error ratio to report, and
	// printing one would assert health that was never measured.
	it('answers no-traffic rather than 0% when nothing was offered', () => {
		const history = [snapshotOf(FULL(100, 5, 10), T0), snapshotOf(FULL(100, 5, 10), T1)];
		const o = requestOutcomes(history, GAP);
		if (o.kind !== 'partitioned') throw new Error('expected partitioned');

		expect(o.offered).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(o.errorRatio).toEqual({kind: 'no-traffic'});
	});

	it('propagates a degenerate rate into the ratio instead of printing a number', () => {
		// One observation: nothing can be diffed yet.
		const warming = requestOutcomes([snapshotOf(FULL(100, 5, 10), T0)], GAP);
		if (warming.kind !== 'partitioned') throw new Error('expected partitioned');
		expect(warming.errorRatio).toEqual({kind: 'not-derivable', reason: 'insufficient-samples'});

		// A restart moves the counters backwards.
		const reset = requestOutcomes([snapshotOf(FULL(200, 105, 20), T0), snapshotOf(FULL(100, 5, 10), T1)], GAP);
		if (reset.kind !== 'partitioned') throw new Error('expected partitioned');
		expect(reset.errorRatio).toEqual({kind: 'not-derivable', reason: 'reset'});

		// A poll gap beyond tolerance must not average over unknown dead time.
		const gapped = requestOutcomes([snapshotOf(FULL(100, 5, 10), T0), snapshotOf(FULL(200, 105, 20), T0 + GAP + 1)], GAP);
		if (gapped.kind !== 'partitioned') throw new Error('expected partitioned');
		expect(gapped.errorRatio).toEqual({kind: 'not-derivable', reason: 'gap'});
	});

	// Each request is counted once: a denial's own 429 must not be added to
	// the numerator a second time via the status arm of the error filter.
	it('does not double-count a denial that also carries a failing status', () => {
		// Denials are the ONLY movement: 5 -> 15 = 1/s, all of it denied 429.
		const history = [snapshotOf(FULL(100, 5, 10), T0), snapshotOf(FULL(100, 15, 10), T1)];
		const o = requestOutcomes(history, GAP);
		if (o.kind !== 'partitioned') throw new Error('expected partitioned');

		expect(o.offered).toEqual({kind: 'ok', perSecond: 1, intervalMs: 10_000});
		// If the 429 were counted under both arms the ratio would read 2.
		expect(o.errorRatio).toEqual({kind: 'ok', ratio: 1});
	});

	// A 4xx a backend answered is a failed response, not a gate denial. The
	// whole reason upstream added `outcome` is that status alone cannot tell
	// them apart, so the page must not merge them back together.
	it('keeps a backend-answered failure out of the denial rate', () => {
		const history = [snapshotOf(FULL(100, 5, 10), T0), snapshotOf(FULL(100, 5, 40), T1)];
		const o = requestOutcomes(history, GAP);
		if (o.kind !== 'partitioned') throw new Error('expected partitioned');

		expect(o.denied).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(o.failed).toEqual({kind: 'ok', perSecond: 3, intervalMs: 10_000});
		expect(o.errorRatio).toEqual({kind: 'ok', ratio: 1});
	});

	// The family vanishing is not a zero: nothing is known about a partition
	// of a family that is not there.
	it('stays warming-up when the family is absent from an observation', () => {
		const history = [snapshotOf('loxilb_lb_rules 3', T0), snapshotOf(FULL(200, 105, 20), T1)];
		const o = requestOutcomes(history, GAP);
		if (o.kind !== 'partitioned') throw new Error('expected partitioned');

		expect(o.offered).toEqual({kind: 'insufficient-samples'});
		expect(o.errorRatio).toEqual({kind: 'not-derivable', reason: 'insufficient-samples'});
	});
});
