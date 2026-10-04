import {describe, expect, it} from 'vitest';
import {defaultsDraftToWire, parseDefaultsIntegerDraft} from './RateLimitDefaultsInputForm';
import {RATE_LIMIT_DEFAULTS_LIMIT_FIELDS} from 'types/ai';

const draft = (over: Record<string, string> = {}) => ({
	scope: 'global' as const,
	rule_ident: '',
	default_user_rps: '0',
	default_user_tpm: '0',
	default_tenant_rps: '0',
	default_tenant_tpm: '0',
	vip_shared_rps: '0',
	vip_shared_tpm: '0',
	...over,
});

describe('rate-limit defaults raw integer draft', () => {
	it('accepts zero and plain positive integers', () => {
		for (const raw of ['0', '1', '5000', '1000000']) {
			expect(parseDefaultsIntegerDraft(raw)).toBe(Number(raw));
		}
	});

	it('does not silently coerce partial, negative, decimal, whitespace or unsafe input', () => {
		// ⚠️ On a REPLACING endpoint an undefined parse must never be read as an
		// intentional 0: that would clear the field rather than leave it.
		for (const raw of ['', '-', '-1', '1.5', ' 100', '100 ', String(Number.MAX_SAFE_INTEGER + 1)]) {
			expect(parseDefaultsIntegerDraft(raw)).toBeUndefined();
		}
	});
});

describe('rate-limit defaults wire projection', () => {
	it('emits ALL SIX limit fields, because the POST replaces the row', () => {
		// ⚠️⚠️ THE DEFECT THIS PINS: the gateway does not merge the body into the
		// stored row. Verified live — posting `{scope:'global',
		// default_user_tpm:5000}` over a row holding `default_user_rps:7` left
		// the stored row as `{default_user_tpm:5000}` alone, and answered 204.
		// An operator editing one number would have destroyed the other five
		// with a success message on screen. So a projection that drops zeros —
		// which is what the API-KEY CREATE form does, one dialog away — is the
		// wrong instinct here and must stay refused.
		const wire = defaultsDraftToWire(draft({default_user_tpm: '5000'}));
		for (const field of RATE_LIMIT_DEFAULTS_LIMIT_FIELDS) {
			expect(wire, `${field} must be sent even when zero`).toHaveProperty(field);
		}
		expect(wire.default_user_tpm).toBe(5000);
		expect(wire.default_user_rps).toBe(0);
	});

	it('never sends a service on the global scope', () => {
		// A service typed while the scope was `rule` and left behind after
		// switching back to `global` would otherwise be posted, and the gateway
		// refuses that body outright (400, fields:["rule_ident"]).
		expect(defaultsDraftToWire(draft({rule_ident: 'svc-1', default_user_rps: '5'})).rule_ident).toBeUndefined();
	});

	it('trims and keeps the service on the rule scope', () => {
		const wire = defaultsDraftToWire({...draft({default_user_rps: '5'}), scope: 'rule', rule_ident: '  svc-1  '});
		expect(wire.rule_ident).toBe('svc-1');
	});
});
