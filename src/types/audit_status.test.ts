//---------------------------------------------------------
// /audit REST → urgent signals (the only facts the metrics cannot give).
//---------------------------------------------------------
// The gateway's audit models are all `omitempty` (api/models/audit_*.go): an
// absent boolean is false and an absent count is 0. So `{}` from /audit/sink is
// "no sink configured", which is not a fault, and a configured sink with no
// `connected` is a sink that is down.
import {describe, expect, it} from 'vitest';
import {auditRestSignals} from './audit_status';

const HEALTHY = {available: true, running: true, seq_high: 10551};

describe('auditRestSignals', () => {
	it('adds nothing for a healthy writer with no sink configured (the testbed answer)', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {}})).toEqual({kind: 'ok'});
	});

	it('adds nothing for a connected sink, even one with past failures', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {enabled: true, connected: true, write_errors: 3}})).toEqual({kind: 'ok'});
	});

	it('reads a configured sink without `connected` as down, with its address, error and failed submissions', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {enabled: true, address: 'siem:6514', last_error: 'x509: bad', write_errors: 4}})).toEqual({
			kind: 'ok',
			sinkDown: {address: 'siem:6514', lastError: 'x509: bad', writeErrors: 4},
		});
	});

	it('does not invent an address or an error the gateway did not report', () => {
		expect(auditRestSignals({kind: 'ok', status: HEALTHY, sink: {enabled: true, address: '', last_error: ''}})).toEqual({
			kind: 'ok',
			sinkDown: {address: undefined, lastError: undefined, writeErrors: 0},
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
});
