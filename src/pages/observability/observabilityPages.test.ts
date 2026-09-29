import {describe, expect, it} from 'vitest';
import {circuitBreakerLabel} from './SecurityPage';

describe('circuitBreakerLabel', () => {
	it('maps the pinned 0/1/2 enum', () => {
		expect(circuitBreakerLabel(0)).toBe('closed');
		expect(circuitBreakerLabel(1)).toBe('open');
		expect(circuitBreakerLabel(2)).toBe('half-open');
	});

	// A value outside the pinned vocabulary must surface raw, never be
	// coerced into a known state — the caller renders the number itself.
	it('answers undefined outside the pinned vocabulary', () => {
		expect(circuitBreakerLabel(3)).toBeUndefined();
		expect(circuitBreakerLabel(-1)).toBeUndefined();
		expect(circuitBreakerLabel(undefined)).toBeUndefined();
		expect(circuitBreakerLabel(Number.NaN)).toBeUndefined();
	});
});
