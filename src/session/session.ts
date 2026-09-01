//---------------------------------------------------------
// UI-P6-4 — one way for a session to end (ES-22 / ES-27).
//
// Before this module the teardown was scattered: the profile menu removed
// `access_token` and navigated, the 401 branch removed `access_token` and
// navigated, and neither touched the persisted React Query cache that App.tsx
// writes to localStorage. Server data therefore outlived the session.
//
// Everything now funnels through `terminateSession`, which is idempotent (N
// parallel 401s tear down once), purges every store that can hold session
// data, and only then navigates — the parent's clear-before-navigate ordering.
//
// This module is deliberately free of React and of the query client itself:
// `fetcher_base` must be able to call it, and a hook cannot be called from
// there. The query-cache purge is registered by the app at start-up.
//---------------------------------------------------------
import {get_root_url, move_forced} from 'common';
import {PROACTIVE_SKEW_MS} from './sessionPolicy';

export type SessionEndReason = 'logout' | 'expired' | 'idle' | 'revoked';

const TOKEN_KEY = 'access_token';
const REASON_KEY = 'session_end_reason';
const REDIRECT_KEY = 'session_redirect_target';
/** Default key of @tanstack/query-sync-storage-persister. */
const PERSISTED_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';
/** Suffix of the metric time-series keys written by createTimeSeriesHook. */
const SERIES_KEY_MARK = '-series_';

/**
 * Purges registered by the app (the query client cannot be imported here
 * without a cycle, and unit tests must be able to run this module alone).
 */
type Purge = () => void | Promise<void>;
const purges: Purge[] = [];

export function registerSessionPurge(purge: Purge): void {
	purges.push(purge);
}

/** Test seam only — drops registered purges so cases cannot leak into each other. */
export function __resetSessionPurges(): void {
	purges.length = 0;
}

//---------------------------------------------------------
// Token inspection
//---------------------------------------------------------

/**
 * Epoch milliseconds at which the token expires.
 *
 * Throws on anything it cannot read with certainty. The caller treats that as
 * a failed login and never installs the token: a token whose lifetime cannot
 * be established must not be trusted for an unbounded session, which is
 * precisely the state the app was in before this task.
 */
export function parseJwtExp(token: string): number {
	const payload = token.split('.')[1];
	if (!payload) throw new Error('malformed token: no payload segment');

	// base64url → base64, and re-pad: real OAM tokens arrive unpadded (the
	// admin token's payload is 86 chars, 86 % 4 === 2). `atob` tolerates that
	// today, but padding explicitly costs nothing and does not depend on how
	// forgiving a given engine's implementation is.
	const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
	const normalized = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
	let claims: unknown;
	try {
		claims = JSON.parse(atob(normalized));
	} catch {
		throw new Error('malformed token: payload is not base64-encoded JSON');
	}

	const exp = (claims as {exp?: unknown})?.exp;
	if (typeof exp !== 'number' || !Number.isFinite(exp)) throw new Error('malformed token: exp is missing or not a finite number');
	return exp * 1000;
}

/**
 * Milliseconds until the proactive logout should fire, clamped at 0 so a token
 * already inside the skew window expires immediately rather than scheduling a
 * negative delay (which `setTimeout` would fire on the next tick anyway, but
 * silently — the clamp makes the intent explicit and testable).
 */
export function msUntilProactiveLogout(token: string): number {
	return Math.max(0, parseJwtExp(token) - PROACTIVE_SKEW_MS - Date.now());
}

//---------------------------------------------------------
// Why the session ended — handed to the login screen once
//---------------------------------------------------------

/**
 * Where the operator was when the session ended, so a re-login returns them
 * there instead of the landing page.
 *
 * Stored ONLY if it is a local path: an absolute or protocol-relative URL
 * would turn the login screen into an open redirect, and a value that is not a
 * path at all cannot be a route.
 *
 * The QUERY STRING IS KEPT. It was dropped originally, on the reasoning that
 * it carries instance names and that the path alone is enough to land on the
 * right page. Both halves turned out to be wrong, and UI-P6-6's ES-12
 * walkthrough caught it: nearly every route under /instance reads `?name=`,
 * and `useInstanceName()` logs an error and calls `move_404()` without it — so
 * signing out of the LB page and back in returned the operator to a page that
 * could not function, which ES-12's decision rule counts as an outright FAIL.
 * The privacy half buys nothing either: the browser's own history already
 * holds the full URL including the query.
 *
 * The fragment is still dropped — it addresses a position within a page, never
 * which page, so it cannot help restore a route.
 */
function rememberRedirectTarget(path: string): void {
	if (!path.startsWith('/') || path.startsWith('//')) return;
	// `move_forced` prepends the app basename, and `location.pathname` already
	// contains it — store the route relative to the app so a deployment served
	// under a sub-path does not end up at /ui/ui/instance/... on re-login.
	const root = get_root_url();
	const withoutRoot = root && path.startsWith(root + '/') ? path.slice(root.length) : path;
	const withoutFragment = withoutRoot.split('#')[0];
	const bare = withoutFragment.split('?')[0];
	if (bare === '/login' || bare === '/') return;
	sessionStorage.setItem(REDIRECT_KEY, withoutFragment);
}

export function consumeRedirectTarget(): string | null {
	const target = sessionStorage.getItem(REDIRECT_KEY);
	sessionStorage.removeItem(REDIRECT_KEY);
	return target || null;
}

export function consumeSessionEndReason(): SessionEndReason | null {
	const reason = sessionStorage.getItem(REASON_KEY);
	sessionStorage.removeItem(REASON_KEY);
	return (reason as SessionEndReason) || null;
}

//---------------------------------------------------------
// Teardown
//---------------------------------------------------------

/**
 * Removes every storage entry that can carry session data.
 *
 * Written as a SCAN rather than a list of known keys. The known keys are
 * removed by name, but anything else whose value embeds the token goes too —
 * so a cache added later cannot silently reintroduce the ES-22 residue. ES-12
 * preference keys (language, table density, layout) hold no session data and
 * are deliberately left alone.
 */
function purgeSessionStorage(token: string): void {
	for (const store of [localStorage, sessionStorage]) {
		const doomed: string[] = [];
		for (let i = 0; i < store.length; i++) {
			const key = store.key(i);
			if (!key) continue;
			const value = store.getItem(key) ?? '';
			if (key === TOKEN_KEY || key === PERSISTED_CACHE_KEY || key.includes(SERIES_KEY_MARK) || (token !== '' && value.includes(token))) doomed.push(key);
		}
		doomed.forEach(key => store.removeItem(key));
	}
}

let terminating = false;

/**
 * Marks a new session as live, which is what makes the teardown guard below
 * meaningful: `terminating` says "this session is already ending", so it must
 * stay set until a NEW session starts. Resetting it when the teardown returns
 * would collapse nothing — with no async purge registered the body runs
 * synchronously, so five parallel 401s would each find the flag clear and tear
 * down five times over.
 *
 * Called by the login path as the token is installed.
 */
export function beginSession(): void {
	terminating = false;
}

/**
 * End the session exactly once.
 *
 * Idempotent by design: five parallel queries answering 401 all call this, and
 * the body must run once — the old code invoked the relocation helper once per
 * 401 and relied on a "am I already on /login?" guard to hide it.
 */
export async function terminateSession(
	reason: SessionEndReason,
	opts?: {onTeardown?: () => void; navigate?: (reason: SessionEndReason) => void; path?: string},
): Promise<void> {
	if (terminating) return;
	terminating = true;

	try {
		const token = localStorage.getItem(TOKEN_KEY) ?? '';

		// In-flight work first: a query that resolves after the purge would
		// repopulate the cache we are about to clear.
		for (const purge of purges) {
			try {
				await purge();
			} catch {
				// A failing purge must never strand the operator in a
				// half-torn-down session; the storage scan below still runs.
			}
		}

		purgeSessionStorage(token);
		sessionStorage.setItem(REASON_KEY, reason);
		// After the purge: the scan clears sessionStorage too, so remembering
		// the route before it would erase what we just stored.
		// pathname + search, not pathname alone: `?name=` is what tells an
		// instance page which instance it is, and without it the operator is
		// returned to a page that immediately 404s (see rememberRedirectTarget).
		rememberRedirectTarget(opts?.path ?? window.location.pathname + window.location.search);
		opts?.onTeardown?.();

		// Clear BEFORE navigate (parent ordering rule): by here every store is
		// already scrubbed, so an interrupted navigation cannot leave residue.
		if (opts?.navigate) opts.navigate(reason);
		else if (!window.location.href.includes('/login')) move_forced('/login');
	} catch (error) {
		// Never leave the operator inside a half-ended session: the guard stays
		// set (this session IS over) and the redirect below is the last resort.
		if (!opts?.navigate && !window.location.href.includes('/login')) move_forced('/login');
		throw error;
	}
}
