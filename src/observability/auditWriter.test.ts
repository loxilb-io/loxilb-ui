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
import {AUDIT_HEARTBEAT_INTERVAL_MS, AUDIT_STREAMS, auditWriter, heartbeatLiveness, trackHeartbeat} from './auditWriter';

const GAP = 35_000;
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

function withWriter(o: {up?: number; beat?: number; written?: Record<string, number>; dropped?: Record<string, number>; writeFailures?: number; reserve?: number} = {}) {
	return [
		NO_WRITER.replace('loxilb_audit_writer_up 0', `loxilb_audit_writer_up ${o.up ?? 1}`),
		`loxilb_audit_last_heartbeat_timestamp_seconds ${o.beat ?? 1_790_000_000}`,
		'loxilb_audit_last_write_timestamp_seconds 1790000001',
		'loxilb_audit_writer_restarts_total 0',
		'loxilb_audit_writer_panics_total 0',
		`loxilb_audit_write_failures_total ${o.writeFailures ?? 0}`,
		`loxilb_audit_reserve_breached ${o.reserve ?? 0}`,
		...AUDIT_STREAMS.map(s => `loxilb_audit_records_written_total{stream="${s}"} ${o.written?.[s] ?? 0}`),
		...AUDIT_STREAMS.flatMap(s => REASONS.map(r => `loxilb_audit_records_dropped_total{stream="${s}",reason="${r}"} ${o.dropped?.[`${s}/${r}`] ?? 0}`)),
	].join('\n');
}

describe('auditWriter', () => {
	it('is unavailable without a healthy snapshot', () => {
		expect(auditWriter(undefined, [], GAP)).toEqual({kind: 'unavailable'});
	});

	// The collector's nil-writer branch: the stream families are absent
	// because no writer exists, not because nothing was written.
	it('reads writer_up=0 without any stream series as no writer configured', () => {
		const s = snapshotOf(NO_WRITER, 0);
		expect(auditWriter(s, [s], GAP)).toEqual({kind: 'not-configured'});
	});

	it('reads a writer that is restarting as present and down, not as unconfigured', () => {
		const s = snapshotOf(withWriter({up: 0}), 0);
		const r = auditWriter(s, [s], GAP);
		expect(r).toMatchObject({kind: 'ok', up: false});
	});

	it('says the gateway does not export the trail when no family is present', () => {
		const s = snapshotOf('loxilb_config_dirty 0', 0);
		expect(auditWriter(s, [s], GAP)).toEqual({kind: 'not-exported'});
	});

	it('reports each stream: written rate and total, dropped as the sum of its reasons', () => {
		const before = snapshotOf(withWriter({written: {data: 100}}), 0);
		const after = snapshotOf(withWriter({written: {data: 150, mgmt: 2}, dropped: {'data/queue_full': 3, 'data/writer_down': 1}}), 10_000);
		const r = auditWriter(after, [before, after], GAP);
		if (r.kind !== 'ok') throw new Error(r.kind);
		const data = r.streams.find(s => s.stream === 'data')!;
		expect(data.writtenTotal).toBe(150);
		expect(data.writtenRate).toMatchObject({kind: 'ok', perSecond: 5});
		expect(data.droppedTotal).toBe(4);
		expect(data.droppedBy).toEqual([
			{reason: 'queue_full', total: 3},
			{reason: 'writer_down', total: 1},
		]);
		const mgmt = r.streams.find(s => s.stream === 'mgmt')!;
		expect(mgmt.droppedTotal).toBe(0);
		expect(mgmt.droppedBy).toEqual([]);
		expect(r.failures.find(f => f.key === 'loxilb_audit_write_failures_total')?.total).toBe(0);
		expect(r.reserveBreached).toBe(false);
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
