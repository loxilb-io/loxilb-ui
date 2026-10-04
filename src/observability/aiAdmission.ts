//---------------------------------------------------------
// AI admission gate and proxy connection overload
//---------------------------------------------------------
// The capacity gate reports one row per model pool of an AI-gateway service,
// in every mode including off: its mode, the units held and the ceilings in
// force, the requests parked, a histogram of how long resumed requests
// waited, and one counter per decision it took.
//
// ⚠️ The decision reasons are NOT a partition of requests, so they are never
// summed into a request count:
//   - a request that waits is counted `queued` when parked and again when it
//     leaves (admitted, queue_timeout, cancelled or drained), and `queued`
//     again each time a woken request loses its unit and is re-parked;
//   - observe_would_shed / observe_would_queue are counted at EACH ceiling
//     that would have refused the request, so one request can count twice;
//   - capacity_shed is also counted when an already admitted request fails to
//     move a leg to another endpoint.
// The page shows one compact summary (the owner's rule: the UI says what is
// urgent, Grafana holds the per-pool and per-reason detail): a rate of
// REFUSAL decisions summed over reasons and pools, labelled as decisions,
// never as requests, and the pools at a ceiling right now.
//
// The three listen/header counters are process-wide TCP-level signals from
// the proxy's listeners, not per pool. ListenDrops INCLUDES ListenOverflows
// (the kernel counts every overflow as a drop too), so the two are never
// added together.

import {IMetricsSnapshot} from 'types/observability';
import {RateResult} from './rates';
import {selectSamples, selectScalar} from './selectors';
import {familySumRate, partitionRate} from './snapshotRates';

export const ADMISSION_MODE = 'loxilb_ai_admission_mode';
export const ADMISSION_INFLIGHT = 'loxilb_ai_admission_inflight';
export const ADMISSION_LIMIT = 'loxilb_ai_admission_limit';
export const ADMISSION_QUEUED = 'loxilb_ai_admission_queued';
export const ADMISSION_DECISIONS = 'loxilb_ai_admission_decisions_total';
export const ADMISSION_ANOMALIES = 'loxilb_ai_admission_anomalies_total';

export const ADMISSION_FAMILIES = [
	ADMISSION_MODE,
	ADMISSION_INFLIGHT,
	ADMISSION_LIMIT,
	ADMISSION_QUEUED,
	ADMISSION_DECISIONS,
	ADMISSION_ANOMALIES,
] as const;

export const PROXY_LISTEN_DROPS = 'loxilb_proxy_listen_drops_total';
export const PROXY_LISTEN_OVERFLOWS = 'loxilb_proxy_listen_overflows_total';
export const PROXY_HEADER_DEADLINE_DROPS = 'loxilb_proxy_header_deadline_drops_total';

export const PROXY_OVERLOAD_FAMILIES = [PROXY_LISTEN_DROPS, PROXY_LISTEN_OVERFLOWS, PROXY_HEADER_DEADLINE_DROPS] as const;

/** Gate mode as the gauge encodes it: 0 off, 1 observe, 2 enforce. */
export type GateMode = 'off' | 'observe' | 'enforce' | 'unknown';

export function gateMode(value: number | undefined): GateMode {
	if (value === 0) return 'off';
	if (value === 1) return 'observe';
	if (value === 2) return 'enforce';
	return 'unknown';
}

/**
 * What a decision did to the request that caused it.
 *   refused  — answered with an error (429/503/504) or, for capacity_shed,
 *              a leg that could not move;
 *   waited   — parked, or left the queue without being served;
 *   observe  — observe mode: admitted, but enforce would have refused/parked;
 *   passed   — admitted, or not an inference request (no unit taken).
 */
export type DecisionGroup = 'refused' | 'waited' | 'observe' | 'passed';

// The gate's closed vocabulary (enum fc_reason), in display order.
export const ADMISSION_REASONS: readonly {reason: string; group: DecisionGroup}[] = [
	{reason: 'capacity_shed', group: 'refused'},
	{reason: 'queue_full', group: 'refused'},
	{reason: 'queue_timeout', group: 'refused'},
	{reason: 'no_healthy_capacity', group: 'refused'},
	{reason: 'draining', group: 'refused'},
	{reason: 'queued', group: 'waited'},
	{reason: 'cancelled', group: 'waited'},
	{reason: 'drained', group: 'waited'},
	{reason: 'observe_would_shed', group: 'observe'},
	{reason: 'observe_would_queue', group: 'observe'},
	{reason: 'admitted', group: 'passed'},
	{reason: 'bypass_non_inference', group: 'passed'},
];

export interface IAdmissionPool {
	service: string;
	pool: string;
	mode: GateMode;
	/** Pool-wide units held (role="service"). */
	inflight: number | undefined;
	/** Pool-wide ceiling (role="service"); 0 = unlimited. */
	limit: number | undefined;
	queued: number | undefined;
	/** Queue depth (role="queue"); 0 = no queue, over a ceiling is refused at once. */
	queueDepth: number | undefined;
}

/** A gated pool holding every unit its ceiling allows, or a full queue. */
export interface ISaturatedPool {
	service: string;
	pool: string;
	what: 'limit' | 'queue';
	value: number;
	bound: number;
}

export type AiAdmissionReport =
	| {kind: 'unavailable'}
	// No pool rows: the gateway has no AI-gateway service with a model pool,
	// or its build predates the gate. Anomalies are still process-wide.
	| {kind: 'no-pools'; anomalyTotal: number | undefined}
	| {
			kind: 'ok';
			pools: IAdmissionPool[];
			/** Process-wide; any increment is a gateway defect, not load. */
			anomalyTotal: number | undefined;
			/** Refusal DECISIONS per second over every pool and refusal reason. */
			refusing: RateResult;
			/** Observe mode: decisions that enforce would have turned into a refusal. */
			wouldRefuse: RateResult;
			saturated: ISaturatedPool[];
	  };

const REFUSAL_REASONS: ReadonlySet<string> = new Set(ADMISSION_REASONS.filter(r => r.group === 'refused').map(r => r.reason));
const OBSERVE_WOULD_SHED = 'observe_would_shed';

function poolScalar(snapshot: IMetricsSnapshot, family: string, service: string, pool: string, extra?: Record<string, string>) {
	return selectScalar(snapshot, family, {service, pool, ...extra});
}

function sumOf(values: (number | undefined)[]): number | undefined {
	const finite = values.filter((v): v is number => v !== undefined && Number.isFinite(v));
	return finite.length === 0 ? undefined : finite.reduce((a, b) => a + b, 0);
}

/** Gated pools at a ceiling now. An off pool bounds nothing; 0 means unlimited / no queue. */
export function saturatedPools(pools: readonly IAdmissionPool[]): ISaturatedPool[] {
	const out: ISaturatedPool[] = [];
	for (const p of pools) {
		if (p.mode === 'off') continue;
		if (p.limit !== undefined && p.limit > 0 && p.inflight !== undefined && p.inflight >= p.limit) {
			out.push({service: p.service, pool: p.pool, what: 'limit', value: p.inflight, bound: p.limit});
		}
		if (p.queueDepth !== undefined && p.queueDepth > 0 && p.queued !== undefined && p.queued >= p.queueDepth) {
			out.push({service: p.service, pool: p.pool, what: 'queue', value: p.queued, bound: p.queueDepth});
		}
	}
	return out;
}

export function aiAdmission(
	snapshot: IMetricsSnapshot | undefined,
	history: readonly IMetricsSnapshot[],
	maxGapMs: number,
): AiAdmissionReport {
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};

	const anomalyTotal = sumOf(selectSamples(snapshot, ADMISSION_ANOMALIES).map(s => (Number.isFinite(s.value) ? s.value : undefined)));

	// The mode gauge is present for every pool whatever the mode, so it is
	// the pool list.
	const modeSamples = selectSamples(snapshot, ADMISSION_MODE);
	if (modeSamples.length === 0) return {kind: 'no-pools', anomalyTotal};

	const pools: IAdmissionPool[] = modeSamples.map(m => {
		const service = m.labels.service ?? '';
		const pool = m.labels.pool ?? '';
		return {
			service,
			pool,
			mode: gateMode(Number.isFinite(m.value) ? m.value : undefined),
			inflight: poolScalar(snapshot, ADMISSION_INFLIGHT, service, pool, {role: 'service'}),
			limit: poolScalar(snapshot, ADMISSION_LIMIT, service, pool, {role: 'service'}),
			queued: poolScalar(snapshot, ADMISSION_QUEUED, service, pool),
			queueDepth: poolScalar(snapshot, ADMISSION_LIMIT, service, pool, {role: 'queue'}),
		};
	});

	return {
		kind: 'ok',
		pools,
		anomalyTotal,
		// Decisions summed as decisions: each one increments exactly one
		// reason child, so the sum counts decisions exactly. It is NOT a
		// request count (see the header), and the page never calls it one.
		refusing: partitionRate(history, ADMISSION_DECISIONS, maxGapMs, l => REFUSAL_REASONS.has(l['reason'] ?? '')),
		wouldRefuse: partitionRate(history, ADMISSION_DECISIONS, maxGapMs, {reason: OBSERVE_WOULD_SHED}),
		saturated: saturatedPools(pools),
	};
}

export interface IOverloadCounter {
	rate: RateResult;
	total: number | undefined;
}

export type ProxyOverloadReport =
	| {kind: 'unavailable'}
	| {
			kind: 'ok';
			/** Every drop at a listening socket, overflows INCLUDED. */
			listenDrops: IOverloadCounter;
			/** The backlog-overflow share of listenDrops — never added to it. */
			listenOverflows: IOverloadCounter;
			headerDeadlineDrops: IOverloadCounter;
	  };

export function proxyOverload(
	snapshot: IMetricsSnapshot | undefined,
	history: readonly IMetricsSnapshot[],
	maxGapMs: number,
): ProxyOverloadReport {
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	const counter = (family: string): IOverloadCounter => ({
		rate: familySumRate(history, family, maxGapMs),
		total: selectScalar(snapshot, family),
	});
	return {
		kind: 'ok',
		listenDrops: counter(PROXY_LISTEN_DROPS),
		listenOverflows: counter(PROXY_LISTEN_OVERFLOWS),
		headerDeadlineDrops: counter(PROXY_HEADER_DEADLINE_DROPS),
	};
}
