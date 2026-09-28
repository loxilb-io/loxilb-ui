import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {__resetSessionProbe, classifyUnauthorized, createDetailedErrorMessage, DOWNLOAD_FILE_STREAM, GET, GET_TEXT, isMutationFailure, POST} from './fetcher_base';

// routed the 401 branch through terminateSession, which navigates via
// move_forced. The contract under test is unchanged — an OAM-origin 401 ends
// the browser session, a gateway-origin one does not — so these assert the
// contract (token gone, sent to /login) rather than the name of the helper.
import {beginSession} from 'session/session';

const redirectToLogin = vi.hoisted(() => vi.fn());
vi.mock('common', async importOriginal => ({
	...(await importOriginal<typeof import('common')>()),
	forced_relocation_to_login: redirectToLogin,
	move_forced: redirectToLogin,
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
	__resetSessionProbe();
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

	it('expires the session on a 401 from the session probe route itself, without a second probe', async () => {
		beginSession();
		localStorage.setItem('access_token', 'expired-token');
		(global.fetch as Mock).mockResolvedValueOnce(new Response('{}', {status: 401}));

		await GET('http://oam/oam/users/me');
		await vi.waitFor(() => expect(redirectToLogin).toHaveBeenCalledOnce());
		expect(localStorage.getItem('access_token')).toBeNull();
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('ends the session on a tokenless 401 without asking OAM', async () => {
		beginSession();
		(global.fetch as Mock).mockResolvedValueOnce(new Response('{}', {status: 401}));

		await GET('http://oam/oam/loxilbs');
		await vi.waitFor(() => expect(redirectToLogin).toHaveBeenCalledOnce());
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	// OAM relays Gateway statuses beyond the pass-through: taking a snapshot
	// while the Gateway refuses OAM's credential answers 401 on an OAM route.
	it('keeps the session when an unmarked 401 on an OAM route is contradicted by OAM', async () => {
		beginSession();
		localStorage.setItem('access_token', 'live-token');
		(global.fetch as Mock)
			.mockResolvedValueOnce(new Response('{"error":"Missing or invalid credentials"}', {status: 401}))
			.mockResolvedValueOnce(new Response('{"username":"admin"}', {status: 200}));

		const response = await POST('http://oam/oam/instances/1/snapshots', {});
		await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(response.code).toBe(401);
		expect(localStorage.getItem('access_token')).toBe('live-token');
		expect(redirectToLogin).not.toHaveBeenCalled();
	});

	// The defect: OAM relays the Gateway's own 401 when the Gateway refuses
	// OAM's management credential, and an OAM without the origin marker relays
	// it bare. Treating that as the session ending signed the operator out a
	// second after every login.
	it('keeps the session when an unattributed pass-through 401 is contradicted by OAM', async () => {
		for (const headers of [{}, {'X-Loxi-Error-Origin': 'unknown'}] as Record<string, string>[]) {
			__resetSessionProbe();
			beginSession();
			localStorage.setItem('access_token', 'live-token');
			(global.fetch as Mock)
				.mockResolvedValueOnce(new Response('{"message":"Missing or invalid credentials"}', {status: 401, headers}))
				.mockResolvedValueOnce(new Response('{"username":"admin"}', {status: 200}));

			const response = await GET('http://oam:8080/oam/loxilbs/1/netlox/v1/config/cistate/all');
			await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(response.code).toBe(401);
			const [probeUrl, probeInit] = (global.fetch as Mock).mock.calls[1];
			expect(probeUrl).toBe('/api/oam/users/me');
			expect(probeInit.headers.Authorization).toBe('Bearer live-token');
			expect(localStorage.getItem('access_token')).toBe('live-token');
			expect(redirectToLogin).not.toHaveBeenCalled();
			(global.fetch as Mock).mockClear();
		}
	});

	it('ends the session when OAM confirms an unattributed pass-through 401', async () => {
		beginSession();
		localStorage.setItem('access_token', 'expired-token');
		(global.fetch as Mock)
			.mockResolvedValueOnce(new Response('{}', {status: 401}))
			.mockResolvedValueOnce(new Response('{}', {status: 401}));

		await GET('http://oam/oam/loxilbs/1/netlox/v1/config/ai/apikey');
		await vi.waitFor(() => expect(redirectToLogin).toHaveBeenCalledOnce());
		expect(localStorage.getItem('access_token')).toBeNull();
	});

	it('asks OAM once for a burst of parallel pass-through 401s', async () => {
		beginSession();
		localStorage.setItem('access_token', 'live-token');
		(global.fetch as Mock).mockImplementation(async (url: string) =>
			String(url).endsWith('/users/me') ? new Response('{}', {status: 200}) : new Response('{}', {status: 401}));

		await Promise.all([1, 2, 3, 4, 5].map(n => GET(`http://oam/oam/loxilbs/1/netlox/v1/r${n}`)));
		await new Promise(resolve => setTimeout(resolve, 0));

		const probes = (global.fetch as Mock).mock.calls.filter(([url]) => String(url).endsWith('/users/me'));
		expect(probes).toHaveLength(1);
		expect(redirectToLogin).not.toHaveBeenCalled();
	});

	// A probe that cannot complete proves nothing about the session. The
	// token's expiry timer and the next OAM-native request still end it.
	it('keeps the session when the confirmation probe cannot complete', async () => {
		beginSession();
		localStorage.setItem('access_token', 'live-token');
		(global.fetch as Mock)
			.mockResolvedValueOnce(new Response('{}', {status: 401}))
			.mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await GET('http://oam/oam/loxilbs/1/netlox/v1/x');
		await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(localStorage.getItem('access_token')).toBe('live-token');
		expect(redirectToLogin).not.toHaveBeenCalled();
	});

	// The verdict is about the token that was sent. If the operator signed in
	// again while the probe was in flight, the new session must survive it.
	it('does not end a session that replaced the probed token mid-flight', async () => {
		beginSession();
		localStorage.setItem('access_token', 'old-token');
		let answerProbe!: (r: Response) => void;
		(global.fetch as Mock)
			.mockResolvedValueOnce(new Response('{}', {status: 401}))
			.mockReturnValueOnce(new Promise<Response>(resolve => { answerProbe = resolve; }));

		await GET('http://oam/oam/loxilbs/1/netlox/v1/x');
		await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
		localStorage.setItem('access_token', 'new-token');
		answerProbe(new Response('{}', {status: 401}));
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(localStorage.getItem('access_token')).toBe('new-token');
		expect(redirectToLogin).not.toHaveBeenCalled();
	});

	it('ignores a marker the client put in its own query string', async () => {
		beginSession();
		localStorage.setItem('access_token', 'expired-token');
		(global.fetch as Mock).mockResolvedValue(new Response('{}', {status: 401}));
		await GET('http://oam/oam/loxilbs/1/netlox/v1/config/ai/apikey', {'X-Loxi-Error-Origin': 'gateway'});
		expect((global.fetch as Mock).mock.calls[0][0]).toContain('X-Loxi-Error-Origin=gateway');
		await vi.waitFor(() => expect(redirectToLogin).toHaveBeenCalledOnce());
		expect(localStorage.getItem('access_token')).toBeNull();
	});

	it('classifies each 401 shape', () => {
		const unauthorized = (headers: Record<string, string> = {}) => new Response('{}', {status: 401, headers});
		const passthrough = 'http://oam/oam/loxilbs/1/netlox/v1/x';
		expect(classifyUnauthorized(unauthorized(), 'http://oam/oam/login')).toBe('inline');
		expect(classifyUnauthorized(unauthorized({'X-Loxi-Error-Origin': 'gateway'}), passthrough)).toBe('inline');
		expect(classifyUnauthorized(unauthorized({'X-Loxi-Error-Origin': ' Gateway '}), passthrough)).toBe('inline');
		expect(classifyUnauthorized(unauthorized({'X-Loxi-Error-Origin': 'oam'}), passthrough)).toBe('expire');
		expect(classifyUnauthorized(unauthorized(), passthrough)).toBe('verify');
		expect(classifyUnauthorized(unauthorized(), 'http://oam/oam/instances/1/snapshots')).toBe('verify');
		expect(classifyUnauthorized(unauthorized(), 'http://oam/oam/users/me')).toBe('expire');
		expect(classifyUnauthorized(unauthorized(), '/api/oam/users/me?fresh=1')).toBe('expire');
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
