//---------------------------------------------------------
// UI-P6-4 — the timers half of session hygiene (ES-27).
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
import {ACTIVITY_EVENTS, IDLE_LIMIT_MS} from './sessionPolicy';
import {msUntilProactiveLogout, terminateSession} from './session';

const TOKEN_KEY = 'access_token';

export function useSessionWatch(): void {
	useEffect(() => {
		// Nothing to watch until someone is actually logged in; the login page
		// must not arm an idle timer against an empty session.
		if (!localStorage.getItem(TOKEN_KEY)) return;

		const timers: ReturnType<typeof setTimeout>[] = [];
		let idleTimer: ReturnType<typeof setTimeout> | undefined;

		const armIdle = () => {
			if (idleTimer !== undefined) clearTimeout(idleTimer);
			idleTimer = setTimeout(() => void terminateSession('idle'), IDLE_LIMIT_MS);
			timers.push(idleTimer);
		};

		// A tab restored from the background may have been away longer than the
		// idle budget while its timer was throttled, so re-arming on return is
		// the conservative reading of "activity", not a free extension.
		const onVisible = () => {
			if (document.visibilityState === 'visible') armIdle();
		};

		// Another tab logging out clears the token; this tab follows rather than
		// waiting for its own 401. `event.key === null` is a storage.clear().
		const onStorage = (event: StorageEvent) => {
			if (event.storageArea !== localStorage) return;
			if (event.key !== null && event.key !== TOKEN_KEY) return;
			if (localStorage.getItem(TOKEN_KEY)) return;
			void terminateSession('logout');
		};

		const token = localStorage.getItem(TOKEN_KEY)!;
		try {
			timers.push(setTimeout(() => void terminateSession('expired'), msUntilProactiveLogout(token)));
		} catch {
			// An unreadable `exp` means the session has no knowable lifetime.
			// The login path refuses such tokens; one already installed (an
			// older build, a hand-edited storage entry) ends now rather than
			// running unbounded.
			void terminateSession('expired');
		}

		armIdle();
		ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, armIdle, {passive: true}));
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('storage', onStorage);

		return () => {
			timers.forEach(clearTimeout);
			ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, armIdle));
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('storage', onStorage);
		};
	}, []);
}
