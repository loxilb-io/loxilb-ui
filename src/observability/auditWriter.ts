//---------------------------------------------------------
// Audit writer health
//---------------------------------------------------------
// The gateway appends every audited management call, data record and
// system event to a durable trail through one writer goroutine. While that
// writer is down every audited management call is REFUSED, so its health is
// an availability signal, not bookkeeping.
//
// Three shapes of exposition, read from the collector:
//   - no writer configured (the audit directory was unusable at start): only
//     writer_up=0 and three process counters are emitted, every other family
//     is absent — that is "not configured", never "no data";
//   - writer present but restarting: writer_up=0 with every family present;
//   - writer running: writer_up=1.
//
// ⭐ The headline is the heartbeat, not the up gauge. The writer records a
// liveness beat every 30 s (DefaultHeartbeatInterval; nothing overrides it),
// and a beat that stops advancing is a writer that is not running whatever
// the counters say. Liveness is judged by whether the VALUE advances across
// our own observations, never by comparing the gateway's timestamp with the
// browser clock: that difference would carry any clock skew into the verdict.

import {IMetricsSnapshot} from 'types/observability';
import {RateResult} from './rates';
import {aggregateSum, selectSamples, selectScalar} from './selectors';
import {partitionRate} from './snapshotRates';

export const AUDIT_FAMILIES = [
	'loxilb_audit_writer_up',
	'loxilb_audit_writer_restarts_total',
	'loxilb_audit_writer_panics_total',
	'loxilb_audit_last_heartbeat_timestamp_seconds',
	'loxilb_audit_last_write_timestamp_seconds',
	'loxilb_audit_records_written_total',
	'loxilb_audit_records_dropped_total',
	'loxilb_audit_records_unattributed_total',
	'loxilb_audit_write_failures_total',
	'loxilb_audit_sync_failures_total',
	'loxilb_audit_result_write_failures_total',
	'loxilb_audit_mgmt_timeouts_total',
	'loxilb_audit_segment_seal_failures_total',
	'loxilb_audit_reserve_breached',
	'loxilb_audit_orphaned_intents_total',
	'loxilb_audit_segments_pruned_total',
	'loxilb_audit_originator_dropped_total',
	'loxilb_audit_delegation_lookups_total',
] as const;

/** The writer's liveness cadence (gateway pkg/audit DefaultHeartbeatInterval). */
export const AUDIT_HEARTBEAT_INTERVAL_MS = 30_000;

/** The trail's streams, in display order. */
export const AUDIT_STREAMS = ['mgmt', 'data', 'audit_system'] as const;

export interface IAuditStream {
	stream: string;
	writtenRate: RateResult;
	writtenTotal: number | undefined;
	/** Every drop reason summed: each is a record that was not written. */
	droppedTotal: number | undefined;
	/** Reasons with a non-zero lifetime count. */
	droppedBy: {reason: string; total: number}[];
}

export interface IAuditFailure {
	key: string;
	total: number | undefined;
}

export type AuditWriterReport =
	| {kind: 'unavailable'}
	// The gateway exports none of the families: a build without the trail.
	| {kind: 'not-exported'}
	// writer_up=0 and no stream series: no writer was ever started.
	| {kind: 'not-configured'}
	| {
			kind: 'ok';
			up: boolean | undefined;
			reserveBreached: boolean | undefined;
			/** Unix seconds as exported; 0 before the first beat/write. */
			lastHeartbeatSeconds: number | undefined;
			lastWriteSeconds: number | undefined;
			streams: IAuditStream[];
			restarts: number | undefined;
			panics: number | undefined;
			/** Losses and refusals: any non-zero value is worth an operator's look. */
			failures: IAuditFailure[];
			/** Housekeeping counts: informational, not faults. */
			activity: IAuditFailure[];
	  };

const scalar = (s: IMetricsSnapshot, family: string) => selectScalar(s, family);

export function auditWriter(snapshot: IMetricsSnapshot | undefined, history: readonly IMetricsSnapshot[], maxGapMs: number): AuditWriterReport {
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	const up = scalar(snapshot, 'loxilb_audit_writer_up');
	const written = selectSamples(snapshot, 'loxilb_audit_records_written_total');
	if (up === undefined && written.length === 0) return {kind: 'not-exported'};
	if (up === 0 && written.length === 0) return {kind: 'not-configured'};

	const streams = AUDIT_STREAMS.map(stream => {
		const dropped = selectSamples(snapshot, 'loxilb_audit_records_dropped_total', {stream});
		return {
			stream,
			writtenRate: partitionRate(history, 'loxilb_audit_records_written_total', maxGapMs, {stream}),
			writtenTotal: selectScalar(snapshot, 'loxilb_audit_records_written_total', {stream}),
			droppedTotal: aggregateSum(dropped).value,
			droppedBy: dropped
				.filter(d => Number.isFinite(d.value) && d.value > 0)
				.map(d => ({reason: d.labels.reason ?? '', total: d.value})),
		};
	});

	const reserve = scalar(snapshot, 'loxilb_audit_reserve_breached');
	const count = (key: string) => ({key, total: scalar(snapshot, key)});
	return {
		kind: 'ok',
		up: up === undefined ? undefined : up > 0,
		reserveBreached: reserve === undefined ? undefined : reserve > 0,
		lastHeartbeatSeconds: scalar(snapshot, 'loxilb_audit_last_heartbeat_timestamp_seconds'),
		lastWriteSeconds: scalar(snapshot, 'loxilb_audit_last_write_timestamp_seconds'),
		streams,
		restarts: scalar(snapshot, 'loxilb_audit_writer_restarts_total'),
		panics: scalar(snapshot, 'loxilb_audit_writer_panics_total'),
		failures: [
			count('loxilb_audit_write_failures_total'),
			count('loxilb_audit_sync_failures_total'),
			count('loxilb_audit_result_write_failures_total'),
			count('loxilb_audit_mgmt_timeouts_total'),
			count('loxilb_audit_segment_seal_failures_total'),
			count('loxilb_audit_records_unattributed_total'),
			count('loxilb_audit_orphaned_intents_total'),
			count('loxilb_audit_originator_dropped_total'),
		],
		activity: [count('loxilb_audit_segments_pruned_total'), count('loxilb_audit_delegation_lookups_total')],
	};
}

//---------------------------------------------------------
// Heartbeat liveness from our own observations
//---------------------------------------------------------

/** What this browser has seen of the heartbeat value, per instance. */
export interface IHeartbeatTrack {
	value: number;
	/** Receive time of the first snapshot that carried `value`. */
	firstSeenAtMs: number;
	/** Whether we have seen the value change at least once. */
	sawAdvance: boolean;
}

export function trackHeartbeat(prev: IHeartbeatTrack | undefined, value: number | undefined, receivedAtMs: number): IHeartbeatTrack | undefined {
	if (value === undefined || !Number.isFinite(value)) return prev;
	if (prev && prev.value === value) return prev;
	return {value, firstSeenAtMs: receivedAtMs, sawAdvance: prev !== undefined};
}

export type HeartbeatLiveness =
	| {kind: 'unknown'}
	// 0: the writer has never recorded a beat.
	| {kind: 'never'}
	| {kind: 'advancing'}
	// Not yet long enough to tell: the value has not changed in `observedMs`.
	| {kind: 'watching'; observedMs: number}
	// Unchanged for AT LEAST `sinceMs`, by this browser's own clock.
	| {kind: 'stalled'; sinceMs: number};

/**
 * Stalled once the same value has been seen for longer than two beats plus
 * one poll: one beat can land just after a scrape, and a slow poll can hide
 * one more. The span is measured between OUR receive times, so it is a lower
 * bound on the real staleness and carries no gateway/browser clock skew.
 */
export function heartbeatLiveness(track: IHeartbeatTrack | undefined, nowReceivedAtMs: number, cadenceMs: number): HeartbeatLiveness {
	if (!track) return {kind: 'unknown'};
	if (track.value <= 0) return {kind: 'never'};
	const unchangedMs = nowReceivedAtMs - track.firstSeenAtMs;
	if (unchangedMs > 2 * AUDIT_HEARTBEAT_INTERVAL_MS + cadenceMs) return {kind: 'stalled', sinceMs: unchangedMs};
	if (track.sawAdvance) return {kind: 'advancing'};
	return {kind: 'watching', observedMs: unchangedMs};
}
