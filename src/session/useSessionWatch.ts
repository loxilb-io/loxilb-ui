//---------------------------------------------------------
// the timers half of session hygiene.
//
// Mounted once at the app root. Three watchers, all funnelling into the same
// `terminateSession`:
//
//   expired — the token's own `exp`, minus a skew margin, so the operator is
//             logged out on a schedule the UI knows rather than discovering it
//             by losing a half-filled form to a surprise redirect;
//   idle    — no qualifying interaction within the policy window;
//   logout  — another TAB cleared the token, so this one must not keep
//             rendering cached server data until its next 401.
//
// The UI schedules UX only. Nothing here extends a token or contradicts the
// server: a 401 still ends the session no matter what these timers believe.
//---------------------------------------------------------
import {useEffect} from 'react';
import {request_logout} from 'connector/oam/oam';
import {ACTIVITY_EVENTS, IDLE_LIMIT_MS} from './sessionPolicy';
import {msUntilProactiveLogout, terminateSession} from './session';

const TOKEN_KEY = 'access_token';

export function useSessionWatch(): void {
	useEffect(() => {
		// Nothing to watch until someone is actually logged in; the login page
		// must not arm an idle timer against an empty session.
		if (!localStorage.getItem(TOKEN_KEY)) return;

		const token = localStorage.getItem(TOKEN_KEY)!;
		let ended = false;
		let deadline = Date.now() + IDLE_LIMIT_MS;
		let idleTimer: ReturnType<typeof setTimeout> | undefined;
		let expiryTimer: ReturnType<typeof setTimeout> | undefined;
		const ownsSession = () => !ended && localStorage.getItem(TOKEN_KEY) === token;
		const endIdle = () => {
			if (!ownsSession()) return;
			ended = true;
			// Capture and dispatch revocation before local teardown. keepalive
			// preserves delivery through navigation; a stalled request must not
			// hold the unattended console open.
			void request_logout();
			void terminateSession('idle');
		};
		const scheduleIdle = () => {
			if (idleTimer !== undefined) clearTimeout(idleTimer);
			if (!ownsSession()) return;
			const remaining = deadline - Date.now();
			if (remaining <= 0) endIdle();
			else idleTimer = setTimeout(scheduleIdle, remaining);
		};
		const onActivity = () => {
			if (!ownsSession()) return;
			deadline = Date.now() + IDLE_LIMIT_MS;
			scheduleIdle();
		};
		const onVisible = () => {
			if (document.visibilityState === 'visible') scheduleIdle();
		};

		// Another tab logging out clears the token; this tab follows rather than
		// waiting for its own 401. `event.key === null` is a storage.clear().
		const onStorage = (event: StorageEvent) => {
			if (event.storageArea !== localStorage) return;
			if (event.key !== null && event.key !== TOKEN_KEY) return;
			const current = localStorage.getItem(TOKEN_KEY);
			if (current) {
				if (current !== token) window.location.reload();
				return;
			}
			void terminateSession('logout');
		};

		try {
			expiryTimer = setTimeout(() => {
				if (ownsSession()) void terminateSession('expired');
			}, msUntilProactiveLogout(token));
		} catch {
			// An unreadable `exp` means the session has no knowable lifetime.
			// The login path refuses such tokens; one already installed (an
			// older build, a hand-edited storage entry) ends now rather than
			// running unbounded.
			void terminateSession('expired');
		}

		scheduleIdle();
		ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, onActivity, {passive: true}));
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('storage', onStorage);

		return () => {
			if (idleTimer !== undefined) clearTimeout(idleTimer);
			if (expiryTimer !== undefined) clearTimeout(expiryTimer);
			ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, onActivity));
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('storage', onStorage);
		};
	}, []);
}
