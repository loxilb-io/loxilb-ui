// What a failed request leaves behind: not performed, or not known.
//
// A change that ends in 502, 504 or no HTTP response at all may have been
// applied: the management hop lost the answer, not necessarily the request.
// Offering "try again" there invites a second create or a delete of something
// already gone. A 503 is different: the Gateway and the management backend
// both answer it BEFORE acting, and say so.
//
// The 503 and 429 bodies below are the ones the producers write. They are
// matched on `message` / `error` because neither producer sends a machine code:
//   Gateway audit refusal    api/restapi/handler/audit_gate.go  (Retry-After: 5)
//   Gateway maintenance      api/restapi/handler/snapshot.go, common.go
//   backend identity         internal/handlers/proxy_error.go
//   backend rate limit       internal/middleware/ratelimit.go   (Retry-After: 1)
import {describe, expect, it} from 'vitest';
import enJSON from 'locales/en.json';
import jaJSON from 'locales/ja.json';
import koJSON from 'locales/ko.json';
import {ApiError, assertOk, SimpleResponse} from './fetcher_base';
import {fromNetworkError, fromSimpleResponse, fromThrownError, runOp} from './opResultAdapter';
import {AUDIT_UNAVAILABLE_KEY, IDENTITY_UNAVAILABLE_KEY, MAINTENANCE_KEY, RATE_LIMITED_KEY, STATUS_LOCALE_KEYS} from './opResultCodes';

function resp(code: number, data: any = null, headers?: Record<string, string>): SimpleResponse {
	return {code, data, message: '', headers: headers ? new Headers(headers) : undefined};
}

const AUDIT_REFUSAL = {code: 503, message: 'Audit unavailable', result: 'audit_unavailable: the audit writer is not accepting records'};
const BOOT_REPLAY = {code: 503, message: 'Maintenance mode', result: 'configuration writes are rejected until the boot config replay settles'};
const OPERATOR_MAINTENANCE = {code: 503, message: 'Maintenance mode', result: 'configuration writes are rejected while operator maintenance is active'};
const IDENTITY = {error: 'Gateway service identity unavailable'};

describe('a change whose answer was lost', () => {
	it.each([[502], [504], [0]])('HTTP %i is outcome unknown and is not offered for retry', code => {
		const res = fromSimpleResponse(resp(code, {error: 'LoxiLB instance unreachable'}), 'lb.create');
		expect(res.status).toBe('unknown');
		expect(res.code).toBe('lb.create.outcome_unknown');
		expect(res.localeKey).toBe(STATUS_LOCALE_KEYS.unknown);
		expect(res.retryable).toBe(false);
		expect(res.httpStatus).toBe(code);
	});

	// The backend's 502 prose distinguishes "connection refused" from "reset
	// after sending". Prose is not a contract, so it is not read: every 502 on
	// a change is unknown, whatever the sentence says.
	it.each([['LoxiLB instance unreachable'], ['Connection to LoxiLB instance was reset'], ['Request to LoxiLB instance was cancelled'], ['Incomplete response from LoxiLB instance']])(
		'a 502 saying "%s" is still unknown',
		error => {
			expect(fromSimpleResponse(resp(502, {error}, {'X-Loxi-Error-Origin': 'oam'}), 'op').status).toBe('unknown');
		},
	);

	it('a thrown fetch is outcome unknown', () => {
		const res = fromNetworkError('lb.create', new TypeError('Failed to fetch'));
		expect(res.status).toBe('unknown');
		expect(res.code).toBe('lb.create.outcome_unknown');
		expect(res.retryable).toBe(false);
		expect(res.httpStatus).toBeUndefined();
		expect(res.rawDetail).toBe('Failed to fetch');
	});

	it('runOp reports a thrown call as unknown, and a 504 as unknown', async () => {
		const thrown = await runOp('vlan.create', async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(thrown.status).toBe('unknown');
		expect((await runOp('vlan.create', async () => resp(504))).status).toBe('unknown');
	});

	it('500 stays a failure: the server answered, and said it failed', () => {
		const res = fromSimpleResponse(resp(500, {error: 'boom'}), 'op');
		expect(res.status).toBe('failed');
		expect(res.retryable).toBe(false);
	});
});

describe('a read whose answer was lost', () => {
	it.each([[502], [504], [0]])('HTTP %i is unavailable and can be retried', code => {
		const res = fromSimpleResponse(resp(code), 'lb.list', 'read');
		expect(res.status).toBe('unavailable');
		expect(res.code).toBe('lb.list.unavailable');
		expect(res.retryable).toBe(true);
	});

	it('a thrown fetch is unavailable and can be retried', () => {
		const res = fromNetworkError('lb.list', new TypeError('Failed to fetch'), 'read');
		expect(res.status).toBe('unavailable');
		expect(res.code).toBe('lb.list.network_error');
		expect(res.retryable).toBe(true);
	});

	it.each([[502], [504]])('a read connector that threw on HTTP %i is never "unknown"', code => {
		const res = fromThrownError('lb.list', new ApiError('x', code));
		expect(res.status).toBe('unavailable');
		expect(res.retryable).toBe(true);
	});

	it('an error that is not an HTTP answer is unavailable, not unknown', () => {
		const res = fromThrownError('lb.list', new TypeError('Failed to fetch'));
		expect(res.status).toBe('unavailable');
		expect(res.retryable).toBe(true);
	});
});

describe('503: refused before acting', () => {
	it('the audit refusal has its own code and carries the wait the Gateway named', () => {
		const res = fromSimpleResponse(resp(503, AUDIT_REFUSAL, {'Retry-After': '5', 'X-Loxi-Error-Origin': 'gateway'}), 'lb.create');
		expect(res.status).toBe('unavailable');
		expect(res.code).toBe('lb.create.audit_unavailable');
		expect(res.localeKey).toBe(AUDIT_UNAVAILABLE_KEY);
		expect(res.retryable).toBe(true);
		expect(res.retryAfterSeconds).toBe(5);
		expect(res.origin).toBe('gateway');
	});

	it('boot replay and restore freeze are maintenance with a wait', () => {
		const res = fromSimpleResponse(resp(503, BOOT_REPLAY, {'Retry-After': '5'}), 'op');
		expect(res.code).toBe('op.maintenance');
		expect(res.localeKey).toBe(MAINTENANCE_KEY);
		expect(res.retryAfterSeconds).toBe(5);
	});

	it('operator maintenance is maintenance with NO wait: the Gateway names none', () => {
		const res = fromSimpleResponse(resp(503, OPERATOR_MAINTENANCE), 'op');
		expect(res.code).toBe('op.maintenance');
		expect(res.retryAfterSeconds).toBeUndefined();
	});

	it('the backend having no credential for the Gateway has its own code', () => {
		const res = fromSimpleResponse(resp(503, IDENTITY, {'X-Loxi-Error-Origin': 'oam'}), 'op');
		expect(res.code).toBe('op.identity_unavailable');
		expect(res.localeKey).toBe(IDENTITY_UNAVAILABLE_KEY);
		expect(res.origin).toBe('oam');
	});

	// Without the marker that sentence is somebody else's body: a Gateway or a
	// proxy in front of it could say the same words about something else.
	it('the same sentence without the backend marker stays generic', () => {
		expect(fromSimpleResponse(resp(503, IDENTITY), 'op').code).toBe('op.unavailable');
		expect(fromSimpleResponse(resp(503, IDENTITY, {'X-Loxi-Error-Origin': 'gateway'}), 'op').code).toBe('op.unavailable');
	});

	it.each([
		['no body', null],
		['an empty object', {}],
		['an unrelated message', {message: 'Service Unavailable'}],
		// The match is on the whole field, not on a fragment of prose.
		['the words inside a longer sentence', {message: 'Audit unavailable for this tenant'}],
		['the phrase in the wrong field', {result: 'Maintenance mode'}],
	])('a 503 with %s stays generic', (_name, body) => {
		const res = fromSimpleResponse(resp(503, body), 'op');
		expect(res.status).toBe('unavailable');
		expect(res.code).toBe('op.unavailable');
		expect(res.localeKey).toBe(STATUS_LOCALE_KEYS.unavailable);
		expect(res.retryable).toBe(true);
		expect(res.retryAfterSeconds).toBeUndefined();
	});

	it('a 503 is "not performed" for a change too: never unknown', () => {
		for (const body of [null, AUDIT_REFUSAL, OPERATOR_MAINTENANCE, IDENTITY]) {
			expect(fromSimpleResponse(resp(503, body), 'op').status).toBe('unavailable');
		}
	});
});

describe('Retry-After and the origin marker', () => {
	it('429 carries the wait and the origin', () => {
		const res = fromSimpleResponse(resp(429, {error: 'Too many requests. Please slow down.'}, {'Retry-After': '1', 'X-Loxi-Error-Origin': 'oam'}), 'op');
		expect(res.code).toBe('op.rate_limited');
		expect(res.localeKey).toBe(RATE_LIMITED_KEY);
		expect(res.retryAfterSeconds).toBe(1);
		expect(res.origin).toBe('oam');
	});

	it.each([
		['absent', undefined],
		['empty', ''],
		['not a number or a date', 'soon'],
		['negative', '-1'],
		['fractional', '1.5'],
	])('a Retry-After that is %s yields no wait at all', (_name, value) => {
		const headers = value === undefined ? undefined : {'Retry-After': value};
		expect(fromSimpleResponse(resp(503, AUDIT_REFUSAL, headers), 'op').retryAfterSeconds).toBeUndefined();
	});

	it.each([
		['gateway', 'gateway'],
		['oam', 'oam'],
		[' OAM ', 'oam'],
		['proxy', undefined],
		['', undefined],
	])('marker "%s" → origin %s', (value, origin) => {
		expect(fromSimpleResponse(resp(403, null, {'X-Loxi-Error-Origin': value}), 'op').origin).toBe(origin);
	});

	it('no marker → no origin', () => {
		expect(fromSimpleResponse(resp(403), 'op').origin).toBeUndefined();
		expect(fromSimpleResponse(resp(403, null, {}), 'op').origin).toBeUndefined();
	});

	it('a success carries neither', () => {
		const res = fromSimpleResponse(resp(200, {result: 'Success'}, {'Retry-After': '5', 'X-Loxi-Error-Origin': 'gateway'}), 'op');
		expect(res.status).toBe('confirmed');
		expect(res.retryAfterSeconds).toBeUndefined();
		expect(res.origin).toBeUndefined();
	});
});

describe('a read connector keeps what the response said', () => {
	function thrownBy(response: SimpleResponse): unknown {
		try {
			assertOk(response, 'GET /x');
		} catch (error) {
			return error;
		}
		throw new Error('assertOk did not throw');
	}

	it('a rate-limited read keeps the wait and the origin', () => {
		const res = fromThrownError('lb.list', thrownBy(resp(429, {error: 'Too many requests. Please slow down.'}, {'Retry-After': '1', 'X-Loxi-Error-Origin': 'oam'})));
		expect(res.code).toBe('lb.list.rate_limited');
		expect(res.retryAfterSeconds).toBe(1);
		expect(res.origin).toBe('oam');
	});

	it('a read refused for the missing credential keeps its code', () => {
		const res = fromThrownError('lb.list', thrownBy(resp(503, IDENTITY, {'X-Loxi-Error-Origin': 'oam'})));
		expect(res.code).toBe('lb.list.identity_unavailable');
		expect(res.retryable).toBe(true);
	});

	it('the diagnostics text is still the connector’s own message', () => {
		const error = thrownBy(resp(503, IDENTITY, {'X-Loxi-Error-Origin': 'oam'})) as ApiError;
		expect(fromThrownError('lb.list', error).rawDetail).toBe(error.message);
	});

	it('an ApiError built without a response still maps by status', () => {
		const res = fromThrownError('lb.list', new ApiError('x', 429));
		expect(res.code).toBe('lb.list.rate_limited');
		expect(res.retryAfterSeconds).toBeUndefined();
	});
});

describe('catalogue', () => {
	it.each([
		['en', enJSON],
		['ko', koJSON],
		['ja', jaJSON],
	])('%s.json carries the new keys', (_lang, catalogue) => {
		for (const key of [STATUS_LOCALE_KEYS.unknown, AUDIT_UNAVAILABLE_KEY, MAINTENANCE_KEY, IDENTITY_UNAVAILABLE_KEY]) {
			expect(catalogue, `missing key: ${key}`).toHaveProperty([key]);
			expect((catalogue as Record<string, string>)[key].trim()).not.toBe('');
		}
	});
});
