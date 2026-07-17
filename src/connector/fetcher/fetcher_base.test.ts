import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {createDetailedErrorMessage, GET, GET_TEXT} from './fetcher_base';

function mockFetch(body: string, init: {status?: number; contentType?: string} = {}) {
	const {status = 200, contentType = 'application/json'} = init;
	const resp = new Response(body, {status, headers: {'Content-Type': contentType}});
	(global.fetch as Mock).mockResolvedValue(resp);
	return resp;
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
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

describe('GET', () => {
	it('serializes params into the query string', async () => {
		mockFetch('{}');
		await GET('http://oam/oam/license/feature-access', {feature: 'metrics'});
		const [url] = (global.fetch as Mock).mock.calls[0];
		expect(url).toBe('http://oam/oam/license/feature-access?feature=metrics');
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
