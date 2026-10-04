//---------------------------------------------------------
// aiAdmission / proxyOverload derivations
//---------------------------------------------------------
// Fixtures follow the live exposition shape: the gate emits every role and
// every reason for every pool in every mode, so an ungated pool is a row of
// zeros with mode 0, not an absence.

import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {ADMISSION_REASONS, IAdmissionPool, aiAdmission, gateMode, proxyOverload, saturatedPools} from './aiAdmission';

const GAP = 35_000;

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

/** One pool, every child the gate emits; `decisions` overrides reason values. */
function poolText(o: {pool?: string; mode?: number; inflight?: number; limit?: number; queued?: number; depth?: number; decisions?: Record<string, number>} = {}) {
	const SVC = `service="10.0.0.1:8080",pool="${o.pool ?? 'p1'}"`;
	const lines = [
		`loxilb_ai_admission_mode{${SVC}} ${o.mode ?? 0}`,
		...['normal', 'prefill', 'decode', 'service'].map(r => `loxilb_ai_admission_inflight{${SVC},role="${r}"} ${r === 'service' ? (o.inflight ?? 0) : 0}`),
		...['normal', 'prefill', 'decode'].map(r => `loxilb_ai_admission_limit{${SVC},role="${r}"} 0`),
		`loxilb_ai_admission_limit{${SVC},role="service"} ${o.limit ?? 0}`,
		`loxilb_ai_admission_limit{${SVC},role="queue"} ${o.depth ?? 0}`,
		`loxilb_ai_admission_queued{${SVC}} ${o.queued ?? 0}`,
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

	// A request that waited is counted `queued` and then `admitted`: two
	// decisions, one request. Only the refusal reasons are summed, and the sum
	// is of decisions — the page captions it so, never as requests.
	it('sums refusal decisions over reasons and pools, and nothing else', () => {
		const before = [poolText({mode: 2}), poolText({pool: 'p2', mode: 2})].join('\n');
		const after = [
			poolText({mode: 2, decisions: {queued: 10, admitted: 10, capacity_shed: 5, queue_timeout: 1}}),
			poolText({pool: 'p2', mode: 2, decisions: {queue_full: 2, draining: 1, no_healthy_capacity: 1, observe_would_shed: 40}}),
		].join('\n');
		const r = aiAdmission(snapshotOf(after, 10_000), [snapshotOf(before, 0), snapshotOf(after, 10_000)], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		// 5 + 1 + 2 + 1 + 1 = 10 refusals over 10 s; queued/admitted/observe excluded.
		expect(r.refusing).toMatchObject({kind: 'ok', perSecond: 1});
		expect(r.wouldRefuse).toMatchObject({kind: 'ok', perSecond: 4});
	});

	it('refuses a rate from one observation instead of printing 0/s', () => {
		const s = snapshotOf(poolText({mode: 2, decisions: {capacity_shed: 5}}), 0);
		const r = aiAdmission(s, [s], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.refusing.kind).toBe('insufficient-samples');
	});

	it('names a pool at its ceiling from the snapshot', () => {
		const s = snapshotOf(poolText({mode: 2, inflight: 8, limit: 8, queued: 4, depth: 4}), 0);
		const r = aiAdmission(s, [s], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.saturated).toEqual([
			{service: '10.0.0.1:8080', pool: 'p1', what: 'limit', value: 8, bound: 8},
			{service: '10.0.0.1:8080', pool: 'p1', what: 'queue', value: 4, bound: 4},
		]);
	});
});

describe('saturatedPools', () => {
	const pool = (o: Partial<IAdmissionPool>): IAdmissionPool => ({
		service: 's', pool: 'p', mode: 'enforce', inflight: 0, limit: 0, queued: 0, queueDepth: 0, ...o,
	});

	// Off bounds nothing; a 0 ceiling is unlimited and a 0 depth is no queue,
	// so none of these is "at a ceiling" however the gauges read.
	it('never flags an off pool, an unlimited ceiling or a missing queue', () => {
		expect(saturatedPools([pool({mode: 'off', inflight: 5, limit: 5})])).toEqual([]);
		expect(saturatedPools([pool({inflight: 5, limit: 0})])).toEqual([]);
		expect(saturatedPools([pool({queued: 0, queueDepth: 0})])).toEqual([]);
	});

	it('flags only a gauge at or over its bound, and skips unknown readings', () => {
		expect(saturatedPools([pool({inflight: 7, limit: 8})])).toEqual([]);
		expect(saturatedPools([pool({inflight: undefined, limit: 8})])).toEqual([]);
		expect(saturatedPools([pool({mode: 'observe', inflight: 9, limit: 8})])).toEqual([{service: 's', pool: 'p', what: 'limit', value: 9, bound: 8}]);
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
