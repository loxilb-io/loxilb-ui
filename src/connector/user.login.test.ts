// UI-P6-1 batch 1 (N-3) — login result contract.
//
// login_user must resolve to a discriminated OpResult with a stable machine
// code and a locale key, instead of throwing raw server prose at the page.
// The OAM lockout response (HTTP 429, begins after the 5th failed attempt)
// must be distinguishable from a plain bad password (HTTP 401), and no raw
// backend text may reach the rendered message (ES-10/ES-18/ES-27).
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import i18n from 'locales/i18n';
import {login_user} from './user';

function mockFetch(body: string, init: {status?: number} = {}) {
	const {status = 200} = init;
	const resp = new Response(body, {status, headers: {'Content-Type': 'application/json'}});
	(global.fetch as Mock).mockResolvedValue(resp);
	return resp;
}

const CREDS = {username: 'operator', password: 'Str0ng!pass1'};

beforeEach(async () => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
	await i18n.changeLanguage('en');
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('login_user OpResult contract', () => {
	it('maps the OAM lockout (429) to denied/auth.locked_out — never raw server prose', async () => {
		// Verbatim OAM wire shape (internal/handlers/handler.go Login):
		mockFetch(JSON.stringify({error: 'Too many failed login attempts. Please try again later. Retry after 47 seconds.', retry_after_seconds: 47}), {status: 429});

		const res: any = await login_user(CREDS);
		expect(res.status).toBe('denied');
		expect(res.code).toBe('auth.locked_out');
		expect(res.retryable).toBe(true);
		// The locale key must resolve WITHOUT leaking the backend sentence or
		// the retry-after policy detail (Q-4 conservative default: no counts,
		// no countdown, until SECURITY_PROFILE.md decides otherwise).
		const rendered = i18n.t(res.localeKey);
		expect(rendered).not.toMatch(/Retry after/i);
		expect(rendered.length).toBeGreaterThan(0);
	});

	it('maps a plain bad password (401) to denied/auth.invalid_credentials', async () => {
		mockFetch(JSON.stringify({error: 'invalid username or password'}), {status: 401});

		const res: any = await login_user(CREDS);
		expect(res.status).toBe('denied');
		expect(res.code).toBe('auth.invalid_credentials');
		expect(res.retryable).toBe(false);
	});

	it('confirms a healthy login and carries the token in data', async () => {
		mockFetch(JSON.stringify({id: 1, token: 'jwt-token-value'}));

		const res: any = await login_user(CREDS);
		expect(res.status).toBe('confirmed');
		expect(res.data?.token).toBe('jwt-token-value');
	});

	it('a 200 with no token is NOT confirmed (empty/foreign body must not log in)', async () => {
		mockFetch(JSON.stringify({unexpected: true}));

		const res: any = await login_user(CREDS);
		expect(res.status).not.toBe('confirmed');
		expect(res.data?.token).toBeUndefined();
	});

	it('a network failure resolves to unavailable instead of throwing at the page', async () => {
		(global.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));

		const res: any = await login_user(CREDS);
		expect(res.status).toBe('unavailable');
		expect(res.retryable).toBe(true);
	});

	it('raw backend prose is confined to rawDetail, never in localeKey', async () => {
		mockFetch(JSON.stringify({error: 'pq: connection refused on backend cluster node-3'}), {status: 401});

		const res: any = await login_user(CREDS);
		expect(String(res.localeKey)).not.toContain('node-3');
		expect(String(res.code)).not.toContain('node-3');
	});
});
