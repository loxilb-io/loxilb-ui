//---------------------------------------------------------
// session hygiene, proven in a real browser.
//
// The unit matrix pins the teardown logic; this proves the whole loop against
// the running app: a real login, a real persisted React Query cache written by
// App.tsx, a real sign-out, and then a storage SCAN of what is left behind.
//
// The residue scan is the stop-ship assertion. Before both logout
// paths cleared exactly one key while the entire query cache — LB rules,
// endpoints, API-key metadata, user lists — stayed in localStorage for the
// next person at a shared operator terminal.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';

// ⚠ This file signs out, and `request_logout()` REVOKES the token server-side.
// The rest of the suite shares one admin token from `.auth/admin.json`, so
// signing out on that shared session poisons every spec that runs after this
// file — proven the hard way: the first full run of this spec failed
// `oam/users.spec.ts` onward with `GET /loxilbs failed: 401`, 26 failures and
// 81 tests never reached.
//
// So these tests run on their OWN session: a blank storage state plus one UI
// login. That costs a single extra login against the rate-limited endpoint per
// run, and the token it revokes is nobody else's.
test.use({storageState: {cookies: [], origins: []}});

const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

/** One UI login into a fresh context — mirrors auth.setup.ts's flow. */
async function signIn(page: import('@playwright/test').Page) {
	await page.goto('login');
	await page.locator('#username').waitFor({state: 'visible', timeout: 20_000});
	await page.locator('#username').fill(ADMIN_USER);
	await page.locator('#password').fill(ADMIN_PASSWORD);
	await page.getByRole('button', {name: 'Login'}).click();
	await expect(page, 'session spec could not sign in').toHaveURL(/\/instance/, {timeout: 20_000});
}

const PERSISTED_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';

/** Everything in web storage that could carry session data. */
async function storageScan(page: import('@playwright/test').Page) {
	return page.evaluate(
		({cacheKey}) => {
			const dump = (store: Storage) => {
				const out: {key: string; length: number}[] = [];
				for (let i = 0; i < store.length; i++) {
					const key = store.key(i)!;
					out.push({key, length: (store.getItem(key) ?? '').length});
				}
				return out;
			};
			const local = dump(localStorage);
			return {
				local,
				session: dump(sessionStorage),
				token: localStorage.getItem('access_token'),
				persistedCache: localStorage.getItem(cacheKey),
				seriesKeys: local.filter(e => e.key.includes('-series_')).map(e => e.key),
			};
		},
		{cacheKey: PERSISTED_CACHE_KEY},
	);
}

/**
 * Signing out revokes the token server-side while queries may still be in
 * flight, so those requests come back 401 and the browser logs them. That is
 * the expected consequence of ending a session, not a defect — and whether it
 * happens at all depends on timing, which is exactly the kind of flake that
 * must be settled deliberately rather than left to luck. Same allowance the
 * no-false-success spec makes for its injected failures.
 */
function allowLogoutFetchNoise(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of 401/i);
}

test('signing out leaves no token, no persisted query cache and no series data', async ({page, consoleGuard}) => {
	allowLogoutFetchNoise(consoleGuard);
	// Own session (see the note at the top): this test revokes its token.
	await signIn(page);

	const before = await storageScan(page);
	expect(before.token, 'the fixture session should be signed in').toBeTruthy();
	// The cache App.tsx persists is what the old logout left behind. The
	// persister throttles its writes, so wait for it rather than assuming it
	// has already landed — this precondition IS the defect's premise, so it is
	// asserted rather than hoped for.
	await expect
		.poll(async () => (await storageScan(page)).persistedCache !== null, {timeout: 20_000, message: 'React Query cache should be persisted to localStorage'})
		.toBe(true);

	// The profile trigger is a clickable Box (id="profile"), not a button —
	// see components/layout/Profile.tsx.
	await page.locator('#profile').click();
	await page.getByRole('menuitem', {name: /sign out/i}).click();
	await page.getByRole('button', {name: /^Yes$/}).click();

	await expect(page).toHaveURL(/\/login/, {timeout: 20_000});

	const after = await storageScan(page);
	expect(after.token).toBeNull();
	expect(after.persistedCache).toBeNull();
	expect(after.seriesKeys).toEqual([]);
});

test('an expired token ends the session with an explanation instead of a silent redirect', async ({page, consoleGuard}) => {
	allowLogoutFetchNoise(consoleGuard);
	await signIn(page);

	// Swap in a well-formed token whose exp is already past: the proactive
	// watcher must end the session on its own, without waiting for a request
	// to bounce 401.
	await page.evaluate(() => {
		const payload = btoa(JSON.stringify({exp: Math.floor(Date.now() / 1000) - 60, role: 'admin'}));
		localStorage.setItem('access_token', `header.${payload}.signature`);
	});
	await page.reload();

	await expect(page).toHaveURL(/\/login/, {timeout: 20_000});
	// Told why — not dumped on a bare login form.
	await expect(page.getByText(/session expired|session ended/i)).toBeVisible();

	const after = await storageScan(page);
	expect(after.token).toBeNull();
	expect(after.persistedCache).toBeNull();
});
