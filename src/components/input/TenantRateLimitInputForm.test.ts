import {describe, expect, it} from 'vitest';
import {parseTenantLimitIntegerDraft} from './TenantRateLimitInputForm';

describe('tenant rate-limit raw integer draft', () => {
	it('accepts zero and the approved burst boundaries', () => {
		for (const raw of ['0', '1', '100', '1000']) {
			expect(parseTenantLimitIntegerDraft(raw)).toBe(Number(raw));
		}
	});

	it('does not silently coerce partial, negative, decimal, whitespace or unsafe input', () => {
		for (const raw of ['', '-', '-1', '1.5', ' 100', '100 ', String(Number.MAX_SAFE_INTEGER + 1)]) {
			expect(parseTenantLimitIntegerDraft(raw)).toBeUndefined();
		}
	});
});
