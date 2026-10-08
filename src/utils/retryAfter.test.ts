import {describe, expect, it} from 'vitest';
import {retryAfterSeconds} from './retryAfter';

describe('retryAfterSeconds', () => {
	it('reads delay-seconds', () => {
		expect(retryAfterSeconds('5')).toBe(5);
		expect(retryAfterSeconds(' 0 ')).toBe(0);
	});

	it('reads an HTTP-date against the clock it is given', () => {
		const now = Date.parse('2026-10-08T00:00:00Z');
		expect(retryAfterSeconds('Thu, 08 Oct 2026 00:00:07 GMT', now)).toBe(7);
		// A date already past is "now", never a negative wait.
		expect(retryAfterSeconds('Thu, 08 Oct 2026 00:00:00 GMT', now + 60_000)).toBe(0);
	});

	it('gives no wait for a value it cannot read', () => {
		for (const v of [undefined, null, '', '   ', '-1', '1.5', 'soon', '5 seconds']) expect(retryAfterSeconds(v)).toBeNull();
	});
});
