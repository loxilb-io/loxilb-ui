import {describe, expect, it} from 'vitest';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {kvExactStatusRetry} from './kvExactStatusHook';

describe('kvExactStatusRetry (FR-05 retry vocabulary)', () => {
	it('never retries terminal statuses: auth, permission, no-status, malformed key', () => {
		for (const status of [401, 403, 404, 422]) {
			expect(kvExactStatusRetry(0, new ApiError('x', status))).toBe(false);
		}
	});

	it('retries 503 and 500 with a bound, then stops for manual retry', () => {
		const unavailable = new ApiError('unavailable', 503);
		expect(kvExactStatusRetry(0, unavailable)).toBe(true);
		expect(kvExactStatusRetry(1, unavailable)).toBe(true);
		expect(kvExactStatusRetry(2, unavailable)).toBe(false);
		expect(kvExactStatusRetry(0, new ApiError('boom', 500))).toBe(true);
	});

	it('treats status-less transport errors as retryable within the same bound', () => {
		expect(kvExactStatusRetry(0, new TypeError('network down'))).toBe(true);
		expect(kvExactStatusRetry(2, new TypeError('network down'))).toBe(false);
	});
});
