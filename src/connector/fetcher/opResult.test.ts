// UI-P6-1 — exhaustive adapter mapping (HTTP → OpStatus → localeKey).
//
// The binding rule under test: anything unrecognized maps to `failed`,
// never to success. And because localeKeys are selected dynamically, the
// static locale:check gate cannot see them — the catalogue-existence test
// at the bottom is what keeps `t(result.localeKey)` from ever rendering a
// bare key.
import {describe, expect, it} from 'vitest';
import enJSON from 'locales/en.json';
import jaJSON from 'locales/ja.json';
import koJSON from 'locales/ko.json';
import {SimpleResponse} from './fetcher_base';
import {fromNetworkError, fromSimpleResponse} from './opResultAdapter';
import {CONFLICT_KEY, LOGIN_FAILED_KEY, LOGIN_INVALID_KEY, LOGIN_LOCKED_KEY, NOT_ENABLED_KEY, RATE_LIMITED_KEY, STATUS_LOCALE_KEYS} from './opResultCodes';

function resp(code: number, data: any = {}, message = ''): SimpleResponse {
	return {code, data, message};
}

describe('fromSimpleResponse status mapping', () => {
	it.each([
		[401, 'denied', '.denied', false],
		[403, 'denied', '.denied', false],
		[400, 'invalid', '.rejected', false],
		[422, 'invalid', '.rejected', false],
		[409, 'invalid', '.conflict', false],
		[429, 'denied', '.rate_limited', true],
		[402, 'denied', '.payment_required', false],
		[501, 'failed', '.not_implemented', false],
		[502, 'unavailable', '.unavailable', true],
		[503, 'unavailable', '.unavailable', true],
		[504, 'unavailable', '.unavailable', true],
		[0, 'unavailable', '.unavailable', true],
	])('HTTP %i → %s', (code, status, codeSuffix, retryable) => {
		const res = fromSimpleResponse(resp(code, {error: 'server prose'}), 'op');
		expect(res.status).toBe(status);
		expect(res.code).toBe(`op${codeSuffix}`);
		expect(res.retryable).toBe(retryable);
		expect(res.httpStatus).toBe(code);
	});

	it.each([301, 304, 418, 500, 599])('unknown HTTP %i → failed (never success)', code => {
		const res = fromSimpleResponse(resp(code), 'op');
		expect(res.status).toBe('failed');
	});

	it('2xx with a healthy body confirms and carries data', () => {
		const res = fromSimpleResponse(resp(200, {id: 7}), 'op');
		expect(res.status).toBe('confirmed');
		expect(res.code).toBe('op.ok');
		expect(res.data).toEqual({id: 7});
	});

	it('201 confirms (create endpoints)', () => {
		expect(fromSimpleResponse(resp(201, {id: 7}), 'op').status).toBe('confirmed');
	});

	it('204/205 confirm despite the bodyless data:null', () => {
		expect(fromSimpleResponse(resp(204, null), 'op').status).toBe('confirmed');
		expect(fromSimpleResponse(resp(205, null), 'op').status).toBe('confirmed');
	});

	it.each(['fail', 'FAILED', ' failure ', 'error'])('200 + {result:"%s"} → failed (the false-success trap)', result => {
		const res = fromSimpleResponse(resp(200, {result}), 'op');
		expect(res.status).toBe('failed');
		expect(res.code).toBe('op.reported_failure');
	});

	it('200 with a non-empty unparseable body (parse_failed) → failed with a parse code', () => {
		const res = fromSimpleResponse({...resp(200, null), parse_failed: true}, 'op');
		expect(res.status).toBe('failed');
		expect(res.code).toBe('op.parse_error');
	});

	it('200 with a genuinely EMPTY body confirms — bodyless upserts are not parse failures', () => {
		// handle_response leaves parse_failed unset for empty bodies; mapping
		// them to failed would false-fail real gateway upserts and push the
		// operator into duplicate retries.
		const res = fromSimpleResponse(resp(200, null), 'op');
		expect(res.status).toBe('confirmed');
		expect(res.data).toBeUndefined();
	});

	it('undefined / garbage input → failed, never throws', () => {
		expect(fromSimpleResponse(undefined as any, 'op').status).toBe('failed');
		expect(fromSimpleResponse(null as any, 'op').status).toBe('failed');
		expect(fromSimpleResponse({} as any, 'op').status).toBe('failed');
	});

	it('raw server prose lands ONLY in rawDetail', () => {
		const res = fromSimpleResponse(resp(500, {error: 'pq: constraint violated on node-3'}), 'op');
		expect(res.rawDetail).toContain('node-3');
		expect(res.code).not.toContain('node-3');
		expect(res.localeKey).not.toContain('node-3');
	});

	it('reads the correlation header when present, stays undefined when absent', () => {
		const withHeader = {...resp(500), headers: new Headers({'X-Correlation-Id': 'abc-123'})};
		expect(fromSimpleResponse(withHeader, 'op').correlationId).toBe('abc-123');
		expect(fromSimpleResponse(resp(500), 'op').correlationId).toBeUndefined();
	});
});

describe('fromNetworkError', () => {
	it('maps a thrown fetch to retryable unavailable with diagnostics-only detail', () => {
		const res = fromNetworkError('op', new TypeError('Failed to fetch'));
		expect(res.status).toBe('unavailable');
		expect(res.retryable).toBe(true);
		expect(res.rawDetail).toBe('Failed to fetch');
	});
});

describe('locale catalogue coverage for dynamically-selected keys', () => {
	const allKeys = [...Object.values(STATUS_LOCALE_KEYS), RATE_LIMITED_KEY, CONFLICT_KEY, NOT_ENABLED_KEY, LOGIN_LOCKED_KEY, LOGIN_INVALID_KEY, LOGIN_FAILED_KEY];
	it.each([
		['en', enJSON],
		['ko', koJSON],
		['ja', jaJSON],
	])('%s.json carries every OpResult locale key', (_lang, catalogue) => {
		for (const key of allKeys) {
			expect(catalogue, `missing key: ${key}`).toHaveProperty([key]);
			expect((catalogue as Record<string, string>)[key].trim()).not.toBe('');
		}
	});
});
