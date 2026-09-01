//---------------------------------------------------------
// UI-P6-4 — session expiry, idle policy, logout hygiene (ES-22 / ES-27)
// (npm test src/session/session.test.ts)
//
// Red-first against three separate defects that exist today:
//
//   1. LOGOUT LEAVES SERVER DATA BEHIND (the headline, ES-22). Both logout
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
import {SessionEndReason, consumeSessionEndReason, msUntilProactiveLogout, parseJwtExp, terminateSession} from 'session/session';

const PERSISTED_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/** A JWT whose payload is exactly {exp}. Signature is irrelevant — never verified client-side. */
function tokenWithExp(expSeconds: number, payloadOverride?: string): string {
	const payload = payloadOverride ?? btoa(JSON.stringify({exp: expSeconds, sub: 'admin'}));
	return `header.${payload}.signature`;
}

/** Everything terminateSession is expected to clear, plus a decoy that must survive. */
function seedLoggedInStorage(token: string) {
	localStorage.setItem('access_token', token);
	localStorage.setItem(PERSISTED_CACHE_KEY, JSON.stringify({clientState: {queries: [{queryKey: ['lb_data', '1'], state: {data: [{serviceArguments: {externalIP: '10.0.0.1'}}]}}]}}));
	localStorage.setItem('conntrack-series_1', JSON.stringify([{timestamp: 1, data: {ct: 5}}]));
	// A stray key that happens to embed the token — the scan must catch this class.
	localStorage.setItem('debug_last_request', JSON.stringify({authorization: `Bearer ${token}`}));
	// ES-12 preference keys must SURVIVE logout (UI-P6-6 owns them).
	localStorage.setItem('i18nextLng', 'ko');
	localStorage.setItem('table_density', 'compact');
}

/** The ES-22 proof: nothing left anywhere that carries session data. */
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

describe('UI-P6-4 — JWT expiry parsing', () => {
	it('reads exp as epoch milliseconds', () => {
		expect(parseJwtExp(tokenWithExp(1_700_000_000))).toBe(1_700_000_000_000);
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

describe('UI-P6-4 — proactive logout scheduling', () => {
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

describe('UI-P6-4 — terminateSession leaves no residue (ES-22)', () => {
	const REASONS: SessionEndReason[] = ['logout', 'expired', 'idle', 'revoked'];

	it.each(REASONS)('purges token, persisted query cache and series storage on %s', async reason => {
		const token = tokenWithExp(1_700_000_000);
		seedLoggedInStorage(token);
		// Sanity: the defect is real before the call — the cache is sitting there.
		expect(localStorage.getItem(PERSISTED_CACHE_KEY)).not.toBeNull();

		await terminateSession(reason);

		expect(residue(token)).toEqual([]);
	});

	it('keeps ES-12 preferences, which are not session data', async () => {
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
