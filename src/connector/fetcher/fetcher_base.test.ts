import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {createDetailedErrorMessage, DOWNLOAD_FILE_STREAM, GET, GET_TEXT, isMutationFailure, shouldExpireOAMSession} from './fetcher_base';

const redirectToLogin = vi.hoisted(() => vi.fn());
vi.mock('common', async importOriginal => ({
	...(await importOriginal<typeof import('common')>()),
	forced_relocation_to_login: redirectToLogin,
}));

function mockFetch(body: string, init: {status?: number; contentType?: string} = {}) {
	const {status = 200, contentType = 'application/json'} = init;
	const resp = new Response(body, {status, headers: {'Content-Type': contentType}});
	(global.fetch as Mock).mockResolvedValue(resp);
	return resp;
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
	redirectToLogin.mockReset();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('GET_TEXT', () => {
	it('sends Accept: */* — the gateway /metrics endpoint 406es on text/plain', async () => {
		// Regression test for commit e8f4556: the gateway's declared `produces`
		// does not include text/plain, so only Accept: */* returns the body.
		mockFetch('lb_rule_count 3\n', {contentType: 'text/plain; version=0.0.4'});
		const resp = await GET_TEXT('http://gw/netlox/v1/metrics');
		const [, options] = (global.fetch as Mock).mock.calls[0];
		expect(options.headers.Accept).toBe('*/*');
		expect(resp.code).toBe(200);
		expect(resp.data).toBe('lb_rule_count 3\n');
	});
});

describe('DOWNLOAD_FILE_STREAM', () => {
	it('sends Accept: */* — go-swagger 406es application/octet-stream on /log-archives', async () => {
		// Regression test for commit 079bf79 (same 406 class as /metrics).
		mockFetch('log line 1\nlog line 2\n', {contentType: 'application/octet-stream'});
		vi.stubGlobal('URL', {...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn()});
		const clicks: string[] = [];
		vi.spyOn(document, 'createElement').mockReturnValue({click: () => clicks.push('click'), set href(_: string) {}, set download(_: string) {}} as any);

		const progress: number[] = [];
		await DOWNLOAD_FILE_STREAM('http://gw/log-archives/a.log', 'a.log', p => progress.push(p.receivedBytes));

		const [, options] = (global.fetch as Mock).mock.calls[0];
		expect(options.headers.Accept).toBe('*/*');
		expect(clicks).toEqual(['click']);
		expect(progress.length).toBeGreaterThan(0);
		expect(progress[progress.length - 1]).toBe('log line 1\nlog line 2\n'.length);
	});

	it('throws on HTTP errors so the card can show a failure toast', async () => {
		mockFetch('{"code":406,"message":"unsupported media type requested"}', {status: 406});
		await expect(DOWNLOAD_FILE_STREAM('http://gw/log-archives/a.log', 'a.log')).rejects.toThrow(/406/);
	});
});

describe('GET', () => {
	it('serializes params into the query string', async () => {
		mockFetch('{}');
		await GET('http://oam/oam/logs', {level: 'error'});
		const [url] = (global.fetch as Mock).mock.calls[0];
		expect(url).toBe('http://oam/oam/logs?level=error');
	});

	it('returns data: null when the body is not JSON instead of throwing', async () => {
		mockFetch('<html>oops</html>', {contentType: 'text/html'});
		const resp = await GET('http://gw/whatever');
		expect(resp.code).toBe(200);
		expect(resp.data).toBeNull();
	});

	it('attaches the bearer token when one is stored, omits it otherwise', async () => {
		mockFetch('{}');
		await GET('http://gw/a');
		expect((global.fetch as Mock).mock.calls[0][1].headers.Authorization).toBeUndefined();

		localStorage.setItem('access_token', 'tok-123');
		mockFetch('{}');
		await GET('http://gw/b');
		expect((global.fetch as Mock).mock.calls[1][1].headers.Authorization).toBe('Bearer tok-123');
	});

	it('keeps the OAM session for a trusted Gateway-origin 401 and returns it inline', async () => {
		localStorage.setItem('access_token', 'oam-browser-token');
		(global.fetch as Mock).mockResolvedValue(new Response('{"result":"bad gateway service credential"}', {
			status: 401,
			headers: {'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'gateway'},
		}));

		const response = await GET('http://oam/loxilbs/1/netlox/v1/config/ai/apikey');
		expect(response.code).toBe(401);
		expect(localStorage.getItem('access_token')).toBe('oam-browser-token');
		expect(redirectToLogin).not.toHaveBeenCalled();
	});

	it('expires the OAM session for an OAM-origin 401', async () => {
		localStorage.setItem('access_token', 'expired-token');
		(global.fetch as Mock).mockResolvedValue(new Response('{}', {
			status: 401,
			headers: {'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'oam'},
		}));

		await GET('http://oam/loxilbs/1/netlox/v1/config/ai/apikey');
		expect(localStorage.getItem('access_token')).toBeNull();
		expect(redirectToLogin).toHaveBeenCalledOnce();
	});

	it('uses conservative legacy logout for a missing/unknown marker and ignores a client query spoof', async () => {
		for (const responseHeaders of [
			{'Content-Type': 'application/json'},
			{'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'unknown'},
		] as Record<string, string>[]) {
			localStorage.setItem('access_token', 'expired-token');
			(global.fetch as Mock).mockResolvedValueOnce(new Response('{}', {status: 401, headers: responseHeaders}));
			await GET('http://oam/loxilbs/1/netlox/v1/config/ai/apikey', undefined);
			expect(localStorage.getItem('access_token')).toBeNull();
		}
		localStorage.setItem('access_token', 'expired-token');
		(global.fetch as Mock).mockResolvedValueOnce(new Response('{}', {status: 401}));
		await GET('http://oam/loxilbs/1/netlox/v1/config/ai/apikey', {'X-Loxi-Error-Origin': 'gateway'});
		expect((global.fetch as Mock).mock.calls.at(-1)?.[0]).toContain('X-Loxi-Error-Origin=gateway');
		expect(localStorage.getItem('access_token')).toBeNull();
		expect(redirectToLogin).toHaveBeenCalledTimes(3);

		const missingMarker = new Response('{}', {status: 401});
		expect(shouldExpireOAMSession(missingMarker, 'http://oam/loxilbs/1/netlox/v1/x')).toBe(true);
	});

	it('keeps login failures inline regardless of response marker compatibility', () => {
		expect(shouldExpireOAMSession(new Response('{}', {status: 401}), 'http://oam/oam/login')).toBe(false);
	});
});

describe('createDetailedErrorMessage', () => {
	it('prefers result > message > error from the body and includes op + code', () => {
		const msg = createDetailedErrorMessage(
			{code: 409, data: {result: 'rule exists', message: 'conflict'}, message: 'Conflict'},
			'Create Load Balancer',
		);
		expect(msg).toContain('rule exists');
		expect(msg).toContain('Create Load Balancer');
		expect(msg).toContain('409');
	});

	it('falls back to the HTTP status text when the body is empty', () => {
		const msg = createDetailedErrorMessage({code: 500, data: null, message: 'Internal Server Error'}, 'Op');
		expect(msg).toContain('Internal Server Error');
	});
});

describe('isMutationFailure', () => {
	it('rejects legacy HTTP-200 failure envelopes without rejecting successful results', () => {
		expect(isMutationFailure({code: 200, data: {result: 'fail'}, message: 'OK'})).toBe(true);
		expect(isMutationFailure({code: 200, data: {result: 'Success'}, message: 'OK'})).toBe(false);
		expect(isMutationFailure({code: 409, data: {result: 'Success'}, message: 'Conflict'})).toBe(true);
	});
});
