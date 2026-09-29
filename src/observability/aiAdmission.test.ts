//---------------------------------------------------------
// aiAdmission / proxyOverload derivations
//---------------------------------------------------------
// Fixtures follow the live exposition shape: the gate emits every role and
// every reason for every pool in every mode, so an ungated pool is a row of
// zeros with mode 0, not an absence.

import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {ADMISSION_REASONS, aiAdmission, gateMode, proxyOverload} from './aiAdmission';

const GAP = 35_000;

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

const SVC = 'service="10.0.0.1:8080",pool="p1"';

/** One pool, every child the gate emits; `decisions` overrides reason values. */
function poolText(o: {mode?: number; inflight?: number; limit?: number; queued?: number; depth?: number; waitSum?: number; waitCount?: number; decisions?: Record<string, number>} = {}) {
	const lines = [
		'# TYPE loxilb_ai_admission_queue_wait_seconds histogram',
		`loxilb_ai_admission_mode{${SVC}} ${o.mode ?? 0}`,
		...['normal', 'prefill', 'decode', 'service'].map(r => `loxilb_ai_admission_inflight{${SVC},role="${r}"} ${r === 'service' ? (o.inflight ?? 0) : 0}`),
		...['normal', 'prefill', 'decode'].map(r => `loxilb_ai_admission_limit{${SVC},role="${r}"} 0`),
		`loxilb_ai_admission_limit{${SVC},role="service"} ${o.limit ?? 0}`,
		`loxilb_ai_admission_limit{${SVC},role="queue"} ${o.depth ?? 0}`,
		`loxilb_ai_admission_queued{${SVC}} ${o.queued ?? 0}`,
		`loxilb_ai_admission_queue_wait_seconds_bucket{${SVC},le="+Inf"} ${o.waitCount ?? 0}`,
		`loxilb_ai_admission_queue_wait_seconds_sum{${SVC}} ${o.waitSum ?? 0}`,
		`loxilb_ai_admission_queue_wait_seconds_count{${SVC}} ${o.waitCount ?? 0}`,
		...ADMISSION_REASONS.map(({reason}) => `loxilb_ai_admission_decisions_total{${SVC},reason="${reason}"} ${o.decisions?.[reason] ?? 0}`),
	];
	return lines.join('\n');
}

const ANOMALIES = (u = 0, p = 0) => [`loxilb_ai_admission_anomalies_total{kind="underflow"} ${u}`, `loxilb_ai_admission_anomalies_total{kind="unknown_permit"} ${p}`].join('\n');

describe('gateMode', () => {
	it('maps the gauge encoding and refuses to guess anything else', () => {
		expect([0, 1, 2].map(gateMode)).toEqual(['off', 'observe', 'enforce']);
		expect(gateMode(3)).toBe('unknown');
		expect(gateMode(undefined)).toBe('unknown');
	});
});

describe('aiAdmission', () => {
	it('is unavailable without a healthy snapshot', () => {
		expect(aiAdmission(undefined, [], GAP)).toEqual({kind: 'unavailable'});
	});

	it('reports no pools, and still the process-wide anomalies, when no pool row exists', () => {
		const s = snapshotOf(ANOMALIES(2, 1), 0);
		expect(aiAdmission(s, [s], GAP)).toEqual({kind: 'no-pools', anomalyTotal: 3});
	});

	it('reads the pool-wide and queue ceilings from their own roles', () => {
		const s = snapshotOf([poolText({mode: 2, inflight: 3, limit: 8, queued: 1, depth: 4}), ANOMALIES()].join('\n'), 0);
		const r = aiAdmission(s, [s], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.pools).toHaveLength(1);
		expect(r.pools[0]).toMatchObject({service: '10.0.0.1:8080', pool: 'p1', mode: 'enforce', inflight: 3, limit: 8, queued: 1, queueDepth: 4});
		expect(r.anomalyTotal).toBe(0);
	});

	it('takes the mean queue wait from the histogram sum and count, and none before any resume', () => {
		const waited = snapshotOf(poolText({mode: 2, waitSum: 3, waitCount: 2}), 0);
		const w = aiAdmission(waited, [waited], GAP);
		if (w.kind !== 'ok') throw new Error(w.kind);
		expect(w.pools[0].resumedTotal).toBe(2);
		expect(w.pools[0].meanWaitSeconds).toBe(1.5);

		const never = snapshotOf(poolText({mode: 2}), 0);
		const n = aiAdmission(never, [never], GAP);
		if (n.kind !== 'ok') throw new Error(n.kind);
		expect(n.pools[0].resumedTotal).toBe(0);
		expect(n.pools[0].meanWaitSeconds).toBeUndefined();
	});

	// A request that waited is counted `queued` and then `admitted`: two
	// decisions, one request. Each reason keeps its own rate; nothing here
	// offers a sum that would read as two requests.
	it('keeps every decision reason as its own rate, one row per reason', () => {
		const before = snapshotOf(poolText({mode: 2}), 0);
		const after = snapshotOf(poolText({mode: 2, decisions: {queued: 10, admitted: 10, capacity_shed: 5}}), 10_000);
		const r = aiAdmission(after, [before, after], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		const byReason = Object.fromEntries(r.pools[0].decisions.map(d => [d.reason, d]));
		expect(r.pools[0].decisions.map(d => d.reason)).toEqual(ADMISSION_REASONS.map(x => x.reason));
		expect(byReason.queued.rate).toMatchObject({kind: 'ok', perSecond: 1});
		expect(byReason.admitted.rate).toMatchObject({kind: 'ok', perSecond: 1});
		expect(byReason.capacity_shed.rate).toMatchObject({kind: 'ok', perSecond: 0.5});
		expect(byReason.capacity_shed.group).toBe('refused');
		expect(byReason.queued.total).toBe(10);
		expect(byReason.cancelled.rate).toMatchObject({kind: 'ok', perSecond: 0});
	});
});

describe('proxyOverload', () => {
	const text = (drops: number, overflows: number, header: number) =>
		[
			`loxilb_proxy_listen_drops_total ${drops}`,
			`loxilb_proxy_listen_overflows_total ${overflows}`,
			`loxilb_proxy_header_deadline_drops_total ${header}`,
		].join('\n');

	// ListenDrops already counts every ListenOverflow: 5 drops of which 3
	// overflows is 5 drops, not 8.
	it('reports listen drops as the all-cause total, overflows as its share', () => {
		const before = snapshotOf(text(0, 0, 0), 0);
		const after = snapshotOf(text(5, 3, 2), 10_000);
		const r = proxyOverload(after, [before, after], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.listenDrops.total).toBe(5);
		expect(r.listenOverflows.total).toBe(3);
		expect(r.listenDrops.rate).toMatchObject({kind: 'ok', perSecond: 0.5});
		expect(r.headerDeadlineDrops.total).toBe(2);
	});

	it('is unavailable without a healthy snapshot', () => {
		expect(proxyOverload(undefined, [], GAP)).toEqual({kind: 'unavailable'});
	});
});
