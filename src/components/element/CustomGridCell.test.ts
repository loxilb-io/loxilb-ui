import {describe, expect, it} from 'vitest';

import {state_color} from './CustomGridCell';

// Guards the single semantic state mapping shared by every state column.
// The bug that motivated it: HA MASTER — the node actually holding the VIP —
// rendered red, identical to a genuine failure.
describe('state_color', () => {
	it('maps healthy states to green', () => {
		// Generic vocabulary (is_active_status)
		expect(state_color('UP')).toBe('success');
		expect(state_color('CONNECTED')).toBe('success');
		expect(state_color('ESTABLISHED')).toBe('success');
		expect(state_color(true)).toBe('success');
		// Domain vocabulary the generic list doesn't know
		expect(state_color('MASTER')).toBe('success');
		expect(state_color('VALID')).toBe('success');
	});

	it('maps in-transition states to amber, not red', () => {
		expect(state_color('CONNECTING')).toBe('warning');
		expect(state_color('REKEYING')).toBe('warning');
		expect(state_color('EXPIRES IN 12d')).toBe('warning');
	});

	it('maps deliberately-off and not-configured states to gray', () => {
		expect(state_color('DISABLED')).toBe('disabled');
		expect(state_color('BACKUP')).toBe('disabled');
		expect(state_color('NOT_DEFINED')).toBe('disabled');
	});

	it('treats a blank state as unreported, not failed', () => {
		expect(state_color('')).toBe('disabled');
		expect(state_color('   ')).toBe('disabled');
	});

	it('still maps genuine failures to red', () => {
		expect(state_color('DOWN')).toBe('error');
		expect(state_color('FAILED')).toBe('error');
		expect(state_color('EXPIRED')).toBe('error');
		expect(state_color(false)).toBe('error');
	});
});
