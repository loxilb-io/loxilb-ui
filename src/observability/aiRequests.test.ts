import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {AI_REQUESTS, completedRequestRate, completedRequestRatesBy, hasOutcomePartition} from './aiRequests';

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
