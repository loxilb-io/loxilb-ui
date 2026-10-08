//---------------------------------------------------------
// /audit REST → urgent signals (the only facts the metrics cannot give).
//---------------------------------------------------------
// The gateway's audit models are all `omitempty` (api/models/audit_*.go): an
// absent boolean is false and an absent count is 0. So `{}` from /audit/sink is
// "no sink configured", which is not a fault, and a configured sink with no
// `connected` is a sink that is down.
import {describe, expect, it} from 'vitest';
import {auditRestSignals, namedSinkNames} from './audit_status';

const HEALTHY = {available: true, running: true, seq_high: 10551};

describe('auditRestSignals', () => {
	it('adds nothing for a healthy writer with no sink configured (the testbed answer)', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {}})).toEqual({kind: 'ok'});
	});

	it('adds nothing for a connected sink, even one with past failures', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {enabled: true, connected: true, write_errors: 3}})).toEqual({kind: 'ok'});
	});

	// A gateway whose status has no `sinks` key predates the per-sink list: the
	// compliance sink's own read is then the only evidence there is.
	it('reads a configured sink without `connected` as down on a gateway that lists no sinks, with its address, error and failed submissions', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {enabled: true, address: 'siem:6514', last_error: 'x509: bad', write_errors: 4}})).toEqual({
			kind: 'ok',
			sinks: [{name: 'compliance', compliance: true, condition: 'disconnected', lagDrops: 0, address: 'siem:6514', lastError: 'x509: bad', writeErrors: 4}],
		});
	});

	it('does not invent an address or an error the gateway did not report', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {enabled: true, address: '', last_error: ''}})).toEqual({
			kind: 'ok',
			sinks: [{name: 'compliance', compliance: true, condition: 'disconnected', lagDrops: 0, address: undefined, lastError: undefined, writeErrors: 0}],
		});
	});

	it('loses only the sink signal when the sink read was refused', () => {
		expect(auditRestSignals({kind: 'ok', status: {...HEALTHY, orphaned_intents: 2, last_orphan_event_id: 'evt-1'}})).toEqual({
			kind: 'ok',
			orphan: {count: 2, eventId: 'evt-1'},
		});
	});

	it('reports orphans only above zero, and never makes one up from a garbled count', () => {
		expect(auditRestSignals({kind: 'ok', status: {...HEALTHY, orphaned_intents: 0}, sink: {}})).toEqual({kind: 'ok'});
		expect(auditRestSignals({kind: 'ok', status: {...HEALTHY, orphaned_intents: 'x' as unknown as number}, sink: {}})).toEqual({kind: 'ok'});
		expect(auditRestSignals({kind: 'ok', status: {...HEALTHY, orphaned_intents: 1}, sink: {}})).toEqual({kind: 'ok', orphan: {count: 1, eventId: undefined}});
	});

	it('adds nothing when no writer was configured: the other fields describe nothing', () => {
		expect(auditRestSignals({kind: 'ok', status: {available: false, orphaned_intents: 5}, sink: {enabled: true}})).toEqual({kind: 'ok'});
	});

	it('maps 403 to forbidden, and 404 or an unread query to nothing at all', () => {
		expect(auditRestSignals({kind: 'forbidden'})).toEqual({kind: 'forbidden'});
		expect(auditRestSignals({kind: 'absent'})).toEqual({kind: 'none'});
		expect(auditRestSignals(undefined)).toEqual({kind: 'none'});
	});

	it('says the sink state is unknown when the read failed, whatever an earlier read answered', () => {
		expect(auditRestSignals(undefined, true)).toEqual({kind: 'unknown'});
		expect(auditRestSignals({kind: 'ok', status: {...HEALTHY, sinks: [{name: 'compliance', compliance: true, state: 'connected'}]}}, true)).toEqual({kind: 'unknown'});
	});
});

// `status.sinks[]` is the one sink list every role may read (the gateway's
// auditSinkStatuses: the compliance sink first, then the named ones). The
// states are pkg/audit's Sink* constants.
describe('auditRestSignals — status.sinks[]', () => {
	const withSinks = (sinks: unknown, sink?: Record<string, unknown>) =>
		auditRestSignals({kind: 'ok', status: {...HEALTHY, sinks: sinks as never}, sink: sink as never});

	it('adds nothing for sinks that are connected or still starting', () => {
		expect(withSinks([
			{name: 'compliance', compliance: true, state: 'connected', in_active_segment: true, lag_records: 12},
			{name: 'edr', state: 'starting'},
		])).toEqual({kind: 'ok'});
	});

	it('adds nothing when the gateway lists no sink: null and [] are both "none configured"', () => {
		expect(withSinks(null)).toEqual({kind: 'ok'});
		expect(withSinks([])).toEqual({kind: 'ok'});
	});

	// Only a status with no `sinks` key at all is a gateway older than the
	// list. A list that is there and empty is the gateway's answer, and the
	// compliance sink's own record does not overrule it.
	it('lets a present, empty list stand against /audit/sink', () => {
		expect(withSinks(null, {enabled: true, address: 'siem:6514'})).toEqual({kind: 'ok'});
		expect(withSinks([], {enabled: true, address: 'siem:6514'})).toEqual({kind: 'ok'});
	});

	it.each(['disconnected', 'stalled', 'stopped'] as const)('raises a named sink that is %s, with no /audit/sink read at all', state => {
		expect(withSinks([{name: 'edr', state}])).toEqual({
			kind: 'ok',
			sinks: [{name: 'edr', compliance: false, condition: state, lagDrops: 0, writeErrors: 0}],
		});
	});

	// Absent is not healthy: `state` is omitempty, and a value this build does
	// not know is not one it may call fine.
	it('reads an absent state as unreported and an unfamiliar one as unrecognized, never as healthy', () => {
		expect(withSinks([{name: 'edr'}, {name: 'lake', state: 'draining'}])).toEqual({
			kind: 'ok',
			sinks: [
				{name: 'edr', compliance: false, condition: 'unreported', lagDrops: 0, writeErrors: 0},
				{name: 'lake', compliance: false, condition: 'unrecognized', state: 'draining', lagDrops: 0, writeErrors: 0},
			],
		});
	});

	it('raises a connected sink that retention overtook: those records never reached it', () => {
		expect(withSinks([{name: 'edr', state: 'connected', lag_drops: 2}])).toEqual({
			kind: 'ok',
			sinks: [{name: 'edr', compliance: false, lagDrops: 2, writeErrors: 0}],
		});
	});

	it('takes the compliance state from the list, and only the address, error and failed submissions from /audit/sink', () => {
		// `connected` on /audit/sink is false until the first record of a
		// session; the list's `starting` is the gateway's own word for that.
		expect(withSinks([{name: 'compliance', compliance: true, state: 'starting'}], {enabled: true, address: 'siem:6514'})).toEqual({kind: 'ok'});
		expect(withSinks([{name: 'compliance', compliance: true, state: 'stalled'}], {enabled: true, connected: true, address: 'siem:6514', last_error: 'no space', write_errors: 3})).toEqual({
			kind: 'ok',
			sinks: [{name: 'compliance', compliance: true, condition: 'stalled', lagDrops: 0, address: 'siem:6514', lastError: 'no space', writeErrors: 3}],
		});
	});

	it('still raises the compliance sink for a caller who may not read /audit/sink', () => {
		expect(withSinks([{name: 'compliance', compliance: true, state: 'disconnected'}])).toEqual({
			kind: 'ok',
			sinks: [{name: 'compliance', compliance: true, condition: 'disconnected', lagDrops: 0, writeErrors: 0}],
		});
	});

	it('never lends the compliance sink\'s address to a named sink', () => {
		expect(withSinks([{name: 'edr', state: 'disconnected'}], {enabled: true, address: 'siem:6514', last_error: 'x'})).toEqual({
			kind: 'ok',
			sinks: [{name: 'edr', compliance: false, condition: 'disconnected', lagDrops: 0, writeErrors: 0}],
		});
	});

	it('skips an element that is not an object rather than failing the whole read', () => {
		expect(withSinks([null, 'x', {name: 'edr', state: 'stopped'}])).toEqual({
			kind: 'ok',
			sinks: [{name: 'edr', compliance: false, condition: 'stopped', lagDrops: 0, writeErrors: 0}],
		});
	});
});

// The Audit Trail page reads each named sink by name; the names come from here.
describe('namedSinkNames', () => {
	it('lists the named sinks in the gateway\'s order and leaves the compliance sink out', () => {
		expect(namedSinkNames({sinks: [{name: 'compliance', compliance: true}, {name: 'lake'}, {name: 'edr'}]})).toEqual(['lake', 'edr']);
	});

	it('reads null and [] as no sink, and a missing key as "cannot say"', () => {
		expect(namedSinkNames({sinks: null as never})).toEqual([]);
		expect(namedSinkNames({sinks: []})).toEqual([]);
		expect(namedSinkNames({})).toBeUndefined();
	});

	it('skips an element with no name, a repeat, and anything that is not an object', () => {
		expect(namedSinkNames({sinks: [null, {state: 'connected'}, {name: 'edr'}, {name: 'edr'}, {name: 'compliance'}] as never})).toEqual(['edr']);
	});
});
