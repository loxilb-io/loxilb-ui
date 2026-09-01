//---------------------------------------------------------
// UI-P6-4 — session hygiene, proven in a real browser (ES-22 / ES-27).
//
// The unit matrix pins the teardown logic; this proves the whole loop against
// the running app: a real login, a real persisted React Query cache written by
// App.tsx, a real sign-out, and then a storage SCAN of what is left behind.
//
// The residue scan is the stop-ship assertion. Before UI-P6-4 both logout
// paths cleared exactly one key while the entire query cache — LB rules,
// endpoints, API-key metadata, user lists — stayed in localStorage for the
// next person at a shared operator terminal.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';

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

test('signing out leaves no token, no persisted query cache and no series data (ES-22)', async ({page}) => {
	// Land on a data-heavy page so the persisted cache is genuinely populated.
	await page.goto('instance');
	await expect(page).toHaveURL(/\/instance/);

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

test('an expired token ends the session with an explanation instead of a silent redirect (ES-27)', async ({page}) => {
	await page.goto('instance');
	await expect(page).toHaveURL(/\/instance/);

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
