//---------------------------------------------------------
// session expiry, idle policy, logout hygiene 
// (npm test src/session/session.test.ts)
//
// Red-first against three separate defects that exist today:
//
// 1. LOGOUT LEAVES SERVER DATA BEHIND (the headline). Both logout
//      paths clear exactly one key, `access_token`. But App.tsx persists the
//      WHOLE React Query cache to localStorage via createSyncStoragePersister
//      (key REACT_QUERY_OFFLINE_CACHE), and the metrics hooks persist their
//      own time series. LB rules, endpoints, API-key metadata and user lists
//      therefore survive logout on a shared operator terminal, readable by
//      the next person and briefly renderable after a re-login as a lower
//      role, until each query refetches.
//
//   2. NO PROACTIVE EXPIRY. Nothing parses the JWT `exp`; the token is used
//      until some request happens to bounce 401, so an operator discovers
//      expiry by losing a half-filled form to a redirect.
//
//   3. THE 401 PATH IS A SCATTERED SIDE EFFECT. N parallel queries that all
//      401 each call the relocation helper — no single idempotent teardown,
//      no localized reason, in-flight work left running.
//
// Test 7 of the task doc (residue scan) is the stop-ship proof and is written
// as a scan, not as an assertion about known keys: it fails on ANY residue
// whose value carries the token, so a future cache layer nobody remembered
// cannot quietly reintroduce the defect.
//---------------------------------------------------------
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {IDLE_LIMIT_MS, PROACTIVE_SKEW_MS} from 'session/sessionPolicy';
import {SessionEndReason, beginSession, consumeRedirectTarget, consumeSessionEndReason, msUntilProactiveLogout, parseJwtExp, terminateSession} from 'session/session';

const PERSISTED_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/** A JWT whose payload is exactly {exp}. Signature is irrelevant — never verified client-side. */
function tokenWithExp(expSeconds: number, payloadOverride?: string): string {
	const payload = payloadOverride ?? btoa(JSON.stringify({exp: expSeconds, sub: 'admin'}));
	return `header.${payload}.signature`;
}

/** Everything terminateSession is expected to clear, plus a decoy that must survive. */
function seedLoggedInStorage(token: string) {
	beginSession(); // installing a token starts a session — mirrors the login path
	localStorage.setItem('access_token', token);
	localStorage.setItem(PERSISTED_CACHE_KEY, JSON.stringify({clientState: {queries: [{queryKey: ['lb_data', '1'], state: {data: [{serviceArguments: {externalIP: '10.0.0.1'}}]}}]}}));
	localStorage.setItem('conntrack-series_1', JSON.stringify([{timestamp: 1, data: {ct: 5}}]));
	// A stray key that happens to embed the token — the scan must catch this class.
	localStorage.setItem('debug_last_request', JSON.stringify({authorization: `Bearer ${token}`}));
	// preference keys must SURVIVE logout ( owns them).
	localStorage.setItem('i18nextLng', 'ko');
	localStorage.setItem('table_density', 'compact');
}

/** The proof: nothing left anywhere that carries session data. */
function residue(token: string): string[] {
	const found: string[] = [];
	for (const store of [localStorage, sessionStorage]) {
		for (let i = 0; i < store.length; i++) {
			const key = store.key(i)!;
			const value = store.getItem(key) ?? '';
			if (key === 'access_token' || key === PERSISTED_CACHE_KEY || key.includes('-series_') || value.includes(token)) found.push(key);
		}
	}
	return found;
}

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('JWT expiry parsing', () => {
	it('reads exp as epoch milliseconds', () => {
		expect(parseJwtExp(tokenWithExp(1_700_000_000))).toBe(1_700_000_000_000);
	});

	it('reads a real OAM token shape: base64url, unpadded, exp alongside role claims', () => {
		// Shaped after a live testbed token — payload length 86 (86 % 4 === 2),
		// no '=' padding, claims {exp, role, user_id, username}.
		const claims = {exp: 1_788_257_880, role: 'admin', user_id: 1, username: 'admin'};
		const unpadded = btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
		expect(unpadded.endsWith('=')).toBe(false);
		expect(parseJwtExp(`header.${unpadded}.signature`)).toBe(1_788_257_880_000);
	});

	it.each([
		['not a jwt at all', 'garbage'],
		['missing payload', 'header.'],
		['payload is not base64', 'header.!!!.sig'],
		['payload has no exp', `header.${btoa(JSON.stringify({sub: 'admin'}))}.sig`],
		['exp is a string', `header.${btoa(JSON.stringify({exp: '1700000000'}))}.sig`],
		['exp is not finite', `header.${btoa(JSON.stringify({exp: Number.POSITIVE_INFINITY}))}.sig`],
	])('rejects a malformed token (%s) rather than guessing', (_label, token) => {
		expect(() => parseJwtExp(token)).toThrow();
	});
});

describe('proactive logout scheduling', () => {
	it('schedules the logout a skew margin BEFORE the server expiry', () => {
		const now = 1_700_000_000_000;
		vi.setSystemTime(now);
		const token = tokenWithExp(now / 1000 + 600); // expires in 10 minutes
		expect(msUntilProactiveLogout(token)).toBe(600_000 - PROACTIVE_SKEW_MS);
	});

	it('never returns a negative delay for a token already inside the skew window', () => {
		const now = 1_700_000_000_000;
		vi.setSystemTime(now);
		expect(msUntilProactiveLogout(tokenWithExp(now / 1000 + 1))).toBe(0);
		expect(msUntilProactiveLogout(tokenWithExp(now / 1000 - 3600))).toBe(0);
	});

	it('leaves a usable idle budget — the policy is not self-defeating', () => {
		expect(IDLE_LIMIT_MS).toBeGreaterThanOrEqual(5 * 60_000);
		expect(PROACTIVE_SKEW_MS).toBeGreaterThan(0);
		expect(PROACTIVE_SKEW_MS).toBeLessThan(IDLE_LIMIT_MS);
	});
});

describe('returning the operator to where they were', () => {
	it('remembers the path so a re-login does not dump the operator on the landing page', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('expired', {path: '/instance/traffic/lb'});

		expect(consumeRedirectTarget()).toBe('/instance/traffic/lb');
		// Consumed once — a later manual visit to /login must not bounce the
		// operator somewhere they did not ask to go.
		expect(consumeRedirectTarget()).toBeNull();
	});

	it('RED: keeps the query string — most instance routes are useless without it', async () => {
		// Found by the customization walkthrough. Dropping the query looked
		// harmless ("the path alone is enough to land on the right page") but
		// nearly every page under /instance reads ?name=: useInstanceName()
		// logs 'Instance name is missing!!' and calls move_404() when it is
		// absent. So a sign-out from the LB page followed by a re-login
		// returned the operator to /instance/traffic/lb with no instance —
		// a broken page and, by that same decision rule, a failure.
		//
		// Proven in a browser before this fix: post-relogin URL was
		// http://localhost:3000/netlox/instance/traffic/lb with 8 console
		// errors. Stripping the query protects nothing anyway — the browser's
		// history already holds the full URL, query and all.
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('expired', {path: '/instance/traffic/lb?name=gw-1'});

		expect(consumeRedirectTarget()).toBe('/instance/traffic/lb?name=gw-1');
	});

	it('drops the fragment, which is never needed to restore a route', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('expired', {path: '/instance/traffic/lb?name=gw-1#row-3'});

		expect(consumeRedirectTarget()).toBe('/instance/traffic/lb?name=gw-1');
	});

	it('never remembers the login page itself', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('revoked', {path: '/login'});
		expect(consumeRedirectTarget()).toBeNull();
	});

	it.each([
		['an absolute URL', 'https://evil.example/steal'],
		['a protocol-relative URL', '//evil.example/steal'],
		// Assembled rather than written literally: a literal script URL trips
		// the no-script-url lint rule, and the point is the value, not the text.
		['a scheme', `${'java'}${'script'}:alert(1)`],
		['a non-path', 'instance/traffic/lb'],
	])('refuses %s — a remembered target is a local path, never a destination', async (_label, path) => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('expired', {path});
		expect(consumeRedirectTarget()).toBeNull();
	});

	it('stores the route relative to the app basename, which move_forced re-adds', async () => {
		// A deployment served under a sub-path has that prefix in
		// location.pathname AND in move_forced's output; storing the raw
		// pathname would land the operator on /ui/ui/instance/... after login.
		vi.stubEnv('REACT_APP_PUBLIC_URL', '/ui');
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('expired', {path: '/ui/instance/traffic/lb'});

		expect(consumeRedirectTarget()).toBe('/instance/traffic/lb');
		vi.unstubAllEnvs();
	});

	// REPLACES an earlier assertion that the query string was dropped "because
	// it can carry identifiers". The customization walkthrough disproved the
	// premise: the pages this feature returns operators to cannot function
	// without ?name=, and the browser's history keeps the full URL regardless,
	// so dropping it cost the feature its purpose and protected nothing.
	it('keeps the whole query string, which is what makes the target usable', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('idle', {path: '/instance/traffic/lb?name=prod-gw&tab=rules'});
		expect(consumeRedirectTarget()).toBe('/instance/traffic/lb?name=prod-gw&tab=rules');
	});
});

describe('terminateSession leaves no residue', () => {
	const REASONS: SessionEndReason[] = ['logout', 'expired', 'idle', 'revoked'];

	it.each(REASONS)('purges token, persisted query cache and series storage on %s', async reason => {
		const token = tokenWithExp(1_700_000_000);
		seedLoggedInStorage(token);
		// Sanity: the defect is real before the call — the cache is sitting there.
		expect(localStorage.getItem(PERSISTED_CACHE_KEY)).not.toBeNull();

		await terminateSession(reason);

		expect(residue(token)).toEqual([]);
	});

	it('keeps preferences, which are not session data', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('logout');

		expect(localStorage.getItem('i18nextLng')).toBe('ko');
		expect(localStorage.getItem('table_density')).toBe('compact');
	});

	it('is idempotent — five parallel 401s tear down once, not five times', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		const onTeardown = vi.fn();

		await Promise.all(Array.from({length: 5}, () => terminateSession('revoked', {onTeardown})));

		expect(onTeardown).toHaveBeenCalledTimes(1);
	});

	it('records the reason for the login screen to explain, then hands it over once', async () => {
		seedLoggedInStorage(tokenWithExp(1_700_000_000));
		await terminateSession('idle');

		expect(consumeSessionEndReason()).toBe('idle');
		// Consumed exactly once: a later reload must not re-accuse the operator
		// of having gone idle.
		expect(consumeSessionEndReason()).toBeNull();
	});

	it('clears storage BEFORE navigating (parent ordering rule)', async () => {
		const token = tokenWithExp(1_700_000_000);
		seedLoggedInStorage(token);
		let residueAtNavigation: string[] | null = null;

		await terminateSession('expired', {navigate: () => void (residueAtNavigation = residue(token))});

		expect(residueAtNavigation).toEqual([]);
	});
});
