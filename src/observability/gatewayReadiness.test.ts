import {describe, expect, it} from 'vitest';
import {gatewayReadiness, isQuiet, MAX_READY_REASONS} from './gatewayReadiness';

describe('gatewayReadiness', () => {
	it('says nothing for a ready gateway in normal operation', () => {
		const r = gatewayReadiness({ready: true, maintenance_state: 'active'});
		expect(r).toEqual({maintenance: false});
		expect(isQuiet(r)).toBe(true);
	});

	it('⭐ an unread or failed diagnostics read claims nothing', () => {
		expect(isQuiet(gatewayReadiness(undefined))).toBe(true);
	});

	it('⭐ a gateway that predates the fields is not read as "not ready"', () => {
		// `ready` is always sent, false included; absent means the field does not exist there.
		const r = gatewayReadiness({});
		expect(r.notReady).toBeUndefined();
		expect(r.maintenance).toBe(false);
		// Reasons with no verdict are not a verdict.
		expect(gatewayReadiness({ready_reasons: ['dependency etcd: timeout']}).notReady).toBeUndefined();
	});

	it('carries the gateway reasons as written', () => {
		const reasons = ['boot config replay has not settled', 'auto-persist failing (3 consecutive; last: disk full) -- recent config changes may not survive a restart'];
		expect(gatewayReadiness({ready: false, ready_reasons: reasons, maintenance_state: 'active'})).toEqual({maintenance: false, notReady: {reasons, more: 0}});
	});

	it('not ready with no reason is still not ready', () => {
		expect(gatewayReadiness({ready: false}).notReady).toEqual({reasons: [], more: 0});
		expect(gatewayReadiness({ready: false, ready_reasons: ['', '  ']}).notReady).toEqual({reasons: [], more: 0});
	});

	it('folds the reasons past the limit into a count instead of a list', () => {
		const reasons = Array.from({length: MAX_READY_REASONS + 2}, (_, i) => `dependency d${i}: refused`);
		const r = gatewayReadiness({ready: false, ready_reasons: reasons});
		expect(r.notReady?.reasons).toEqual(reasons.slice(0, MAX_READY_REASONS));
		expect(r.notReady?.more).toBe(2);
	});

	it('maintenance is its own fact, with or without readiness', () => {
		expect(gatewayReadiness({ready: true, maintenance_state: 'maintenance'})).toEqual({maintenance: true});
		const both = gatewayReadiness({ready: false, ready_reasons: ['boot config replay has not settled'], maintenance_state: 'maintenance'});
		expect(both.maintenance).toBe(true);
		expect(both.notReady?.reasons).toHaveLength(1);
	});

	it('an unknown maintenance state is not maintenance', () => {
		expect(gatewayReadiness({ready: true, maintenance_state: 'draining'}).maintenance).toBe(false);
		expect(gatewayReadiness({ready: true}).maintenance).toBe(false);
	});
});
