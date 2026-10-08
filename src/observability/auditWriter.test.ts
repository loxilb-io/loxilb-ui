//---------------------------------------------------------
// auditWriter / heartbeat liveness
//---------------------------------------------------------
// Exposition shapes follow the gateway collector: with no writer configured
// it emits writer_up=0 and three process counters ONLY; with a writer it
// emits every family, including one dropped child per stream × reason.
// Liveness is judged from receive times passed in: no real clock anywhere.

import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {AUDIT_FAULT_COUNTERS, AUDIT_HEARTBEAT_INTERVAL_MS, AUDIT_STREAMS, auditWriter, heartbeatLiveness, trackHeartbeat} from './auditWriter';

const CADENCE = 10_000;
const REASONS = ['queue_full', 'writer_down', 'invalid', 'disk_reserve'];

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

const NO_WRITER = [
	'loxilb_audit_result_write_failures_total 0',
	'loxilb_audit_originator_dropped_total 0',
	'loxilb_audit_delegation_lookups_total 0',
	'loxilb_audit_writer_up 0',
].join('\n');

type SinkCounters = {poison?: number; lagDrops?: number};

function withWriter(o: {up?: number; beat?: number; written?: Record<string, number>; dropped?: Record<string, number>; writeFailures?: number; restarts?: number; reserve?: number; lostToRetention?: number; sinks?: Record<string, SinkCounters>} = {}) {
	return [
		NO_WRITER.replace('loxilb_audit_writer_up 0', `loxilb_audit_writer_up ${o.up ?? 1}`),
		`loxilb_audit_last_heartbeat_timestamp_seconds ${o.beat ?? 1_790_000_000}`,
		`loxilb_audit_writer_restarts_total ${o.restarts ?? 0}`,
		'loxilb_audit_writer_panics_total 0',
		`loxilb_audit_write_failures_total ${o.writeFailures ?? 0}`,
		`loxilb_audit_reserve_breached ${o.reserve ?? 0}`,
		'loxilb_audit_sync_failures_total 0',
		'loxilb_audit_mgmt_timeouts_total 0',
		'loxilb_audit_segment_seal_failures_total 0',
		'loxilb_audit_records_unattributed_total 0',
		'loxilb_audit_orphaned_intents_total 0',
		'loxilb_audit_segments_pruned_total 7',
		`loxilb_audit_records_lost_to_retention_total ${o.lostToRetention ?? 0}`,
		// The per-sink families exist for a sink while it is configured.
		...Object.entries(o.sinks ?? {}).flatMap(([sink, c]) => [
			`loxilb_audit_sink_connected{sink="${sink}"} 1`,
			`loxilb_audit_sink_poison_total{sink="${sink}"} ${c.poison ?? 0}`,
			`loxilb_audit_sink_lag_drops_total{sink="${sink}"} ${c.lagDrops ?? 0}`,
		]),
		...AUDIT_STREAMS.map(s => `loxilb_audit_records_written_total{stream="${s}"} ${o.written?.[s] ?? 0}`),
		...AUDIT_STREAMS.flatMap(s => REASONS.map(r => `loxilb_audit_records_dropped_total{stream="${s}",reason="${r}"} ${o.dropped?.[`${s}/${r}`] ?? 0}`)),
	].join('\n');
}

describe('auditWriter', () => {
	it('is unavailable without a healthy snapshot', () => {
		expect(auditWriter(undefined)).toEqual({kind: 'unavailable'});
	});

	// The collector's nil-writer branch: the stream families are absent
	// because no writer exists, not because nothing was written.
	it('reads writer_up=0 without any stream series as no writer configured', () => {
		const s = snapshotOf(NO_WRITER, 0);
		expect(auditWriter(s)).toEqual({kind: 'not-configured'});
	});

	it('reads a writer that is restarting as present and down, not as unconfigured', () => {
		const s = snapshotOf(withWriter({up: 0}), 0);
		const r = auditWriter(s);
		expect(r).toMatchObject({kind: 'ok', up: false});
	});

	it('says the gateway does not export the trail when no family is present', () => {
		const s = snapshotOf('loxilb_config_dirty 0', 0);
		expect(auditWriter(s)).toEqual({kind: 'not-exported'});
	});

	it('reports drops per stream as the sum of that stream\'s reasons, never across streams', () => {
		const s = snapshotOf(withWriter({dropped: {'data/queue_full': 3, 'data/writer_down': 1, 'mgmt/writer_down': 2}}), 0);
		const r = auditWriter(s);
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.drops).toEqual([
			{stream: 'mgmt', total: 2, by: [{reason: 'writer_down', total: 2}]},
			{
				stream: 'data',
				total: 4,
				by: [
					{reason: 'queue_full', total: 3},
					{reason: 'writer_down', total: 1},
				],
			},
			{stream: 'audit_system', total: 0, by: []},
		]);
		expect(r.reserveBreached).toBe(false);
	});

	it('an absent dropped family is not reported, never 0', () => {
		const text = withWriter()
			.split('\n')
			.filter(l => !l.startsWith('loxilb_audit_records_dropped_total'))
			.join('\n');
		const r = auditWriter(snapshotOf(text, 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.drops.map(d => d.total)).toEqual([undefined, undefined, undefined]);
	});

	it('a healthy writer has no fault above zero, and housekeeping is never a fault', () => {
		const r = auditWriter(snapshotOf(withWriter(), 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		// segments_pruned is 7 in the fixture: retention pruning is not a fault.
		expect(r.faults).toEqual([]);
		expect(r.faultsNotReported).toBe(0);
	});

	it('counts restarts as a fault (each one refused management calls), in a fixed order', () => {
		const r = auditWriter(snapshotOf(withWriter({restarts: 2, writeFailures: 5}), 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.faults).toEqual([
			{key: 'loxilb_audit_writer_restarts_total', total: 2},
			{key: 'loxilb_audit_write_failures_total', total: 5},
		]);
	});

	it('counts an absent fault counter as not reported, never as zero', () => {
		const text = withWriter()
			.split('\n')
			.filter(l => !l.startsWith('loxilb_audit_sync_failures_total'))
			.join('\n');
		const r = auditWriter(snapshotOf(text, 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.faultsNotReported).toBe(1);
		expect(r.faults).toEqual([]);
	});

	// Pruning is housekeeping; pruning a segment a sink had not been sent is a
	// loss, and the gateway counts it apart.
	it('counts records retention deleted before every sink was sent them as a fault', () => {
		const r = auditWriter(snapshotOf(withWriter({lostToRetention: 40}), 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.faults).toEqual([{key: 'loxilb_audit_records_lost_to_retention_total', total: 40}]);
	});

	it('reports per sink only the losses above zero: a sink that lost nothing adds nothing', () => {
		const r = auditWriter(snapshotOf(withWriter({sinks: {compliance: {}, edr: {poison: 3}, lake: {lagDrops: 1}, both: {poison: 2, lagDrops: 5}}}), 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.sinks).toEqual([
			{name: 'both', poison: 2, lagDrops: 5},
			{name: 'edr', poison: 3, lagDrops: 0},
			{name: 'lake', poison: 0, lagDrops: 1},
		]);
	});

	it('reports no sink loss for a gateway with no sink, or one that exports no sink family', () => {
		const r = auditWriter(snapshotOf(withWriter(), 0));
		if (r.kind !== 'ok') throw new Error(r.kind);
		expect(r.sinks).toEqual([]);
	});

	it('pins the fault set: eleven counters, housekeeping excluded', () => {
		expect(AUDIT_FAULT_COUNTERS).toHaveLength(11);
		expect(AUDIT_FAULT_COUNTERS).not.toContain('loxilb_audit_segments_pruned_total');
		expect(AUDIT_FAULT_COUNTERS).not.toContain('loxilb_audit_delegation_lookups_total');
	});
});

describe('heartbeat liveness', () => {
	const STALL_AFTER = 2 * AUDIT_HEARTBEAT_INTERVAL_MS + CADENCE;

	it('keeps the first-seen time while the value repeats, and resets it on a change', () => {
		const a = trackHeartbeat(undefined, 100, 0);
		expect(a).toEqual({value: 100, firstSeenAtMs: 0, sawAdvance: false});
		expect(trackHeartbeat(a, 100, 10_000)).toBe(a);
		expect(trackHeartbeat(a, 130, 30_000)).toEqual({value: 130, firstSeenAtMs: 30_000, sawAdvance: true});
		// A missing value leaves the track alone rather than resetting it.
		expect(trackHeartbeat(a, undefined, 40_000)).toBe(a);
	});

	it('says never for a writer that has not beaten yet, unknown with nothing seen', () => {
		expect(heartbeatLiveness(undefined, 0, CADENCE)).toEqual({kind: 'unknown'});
		expect(heartbeatLiveness(trackHeartbeat(undefined, 0, 0), 0, CADENCE)).toEqual({kind: 'never'});
	});

	it('watches, without a verdict, until it has seen the value change', () => {
		const t = trackHeartbeat(undefined, 100, 0);
		expect(heartbeatLiveness(t, 20_000, CADENCE)).toEqual({kind: 'watching', observedMs: 20_000});
	});

	it('reports advancing once a change was seen and the new value is fresh', () => {
		const t = trackHeartbeat(trackHeartbeat(undefined, 100, 0), 130, 30_000);
		expect(heartbeatLiveness(t, 40_000, CADENCE)).toEqual({kind: 'advancing'});
	});

	// Two beats plus a poll: one beat can land just after a scrape and a slow
	// poll can hide one more, so the boundary itself is not yet a stall.
	it('calls a value stalled only once it outlived two beats plus a poll', () => {
		const t = trackHeartbeat(trackHeartbeat(undefined, 100, 0), 130, 30_000);
		expect(heartbeatLiveness(t, 30_000 + STALL_AFTER, CADENCE)).toEqual({kind: 'advancing'});
		expect(heartbeatLiveness(t, 30_000 + STALL_AFTER + 1, CADENCE)).toEqual({kind: 'stalled', sinceMs: STALL_AFTER + 1});
	});

	it('also stalls a value never seen to change, once it is old enough', () => {
		const t = trackHeartbeat(undefined, 100, 0);
		expect(heartbeatLiveness(t, STALL_AFTER + 1, CADENCE)).toEqual({kind: 'stalled', sinceMs: STALL_AFTER + 1});
	});

	// ⭐ Clock skew: a gateway whose clock runs an hour behind still beats,
	// and nothing here compares its timestamp with ours.
	it('is independent of the gateway clock value itself', () => {
		const skewed = trackHeartbeat(trackHeartbeat(undefined, 1_000, 0), 1_030, 30_000);
		expect(heartbeatLiveness(skewed, 40_000, CADENCE)).toEqual({kind: 'advancing'});
	});
});
