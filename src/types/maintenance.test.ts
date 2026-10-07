//---------------------------------------------------------
// Reading a gateway's maintenance state.
//
// `state=maintenance` closes the management plane; it does not say traffic is
// draining. That is a second answer, and a gateway with no data path behind
// it answers false. These pin that the two are never folded together, that an
// absent counter is a zero only where the gateway's own encoding makes it
// one, and what a drain window may be.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {inFlightRequests, maintenancePhase, parseDrainWindow} from './maintenance';

describe('maintenancePhase', () => {
	it('is active only when the gateway says active', () => {
		expect(maintenancePhase({state: 'active', refusing_new_inference: false})).toBe('active');
	});

	it('is a drain only when new inference is refused', () => {
		expect(maintenancePhase({state: 'maintenance', refusing_new_inference: true})).toBe('draining');
	});

	it('does not call maintenance a drain when inference is not refused', () => {
		expect(maintenancePhase({state: 'maintenance', refusing_new_inference: false})).toBe('config-only');
	});

	it('does not guess for a gateway that does not say', () => {
		expect(maintenancePhase({state: 'maintenance'})).toBe('maintenance-unreported');
	});

	it('does not read a missing or unknown state as active', () => {
		expect(maintenancePhase(undefined)).toBe('unknown');
		expect(maintenancePhase({})).toBe('unknown');
		expect(maintenancePhase({state: 'paused' as 'active'})).toBe('unknown');
	});
});

describe('inFlightRequests', () => {
	it('passes a reported count through, zero included', () => {
		expect(inFlightRequests({in_flight_requests: 7, refusing_new_inference: true})).toBe(7);
		expect(inFlightRequests({in_flight_requests: 0, refusing_new_inference: true})).toBe(0);
	});

	it('reads the omitted counter as zero on a gateway that reports inference refusal', () => {
		expect(inFlightRequests({refusing_new_inference: true})).toBe(0);
		expect(inFlightRequests({refusing_new_inference: false})).toBe(0);
	});

	it('is not reported on a gateway that has neither field', () => {
		expect(inFlightRequests({})).toBeUndefined();
	});
});

describe('parseDrainWindow', () => {
	it('declares no window for empty input', () => {
		expect(parseDrainWindow('')).toEqual({});
		expect(parseDrainWindow('   ')).toEqual({});
	});

	it('takes whole seconds', () => {
		expect(parseDrainWindow('120')).toEqual({seconds: 120});
		expect(parseDrainWindow(' 0 ')).toEqual({seconds: 0});
		expect(parseDrainWindow('4294967295')).toEqual({seconds: 4294967295});
	});

	it('refuses what the gateway could not hold', () => {
		expect(parseDrainWindow('4294967296').error).toBe('too-large');
		for (const bad of ['-1', '1.5', '30s', '1e3', 'abc']) expect(parseDrainWindow(bad).error).toBe('not-a-whole-number');
	});
});
