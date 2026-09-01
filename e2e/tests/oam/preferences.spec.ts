//---------------------------------------------------------
// UI-P6-6 — UI customization persists across reload and re-login (ES-12).
//
// ES-12 is evaluated as a procedure: discover each customization the product
// claims, change it, apply it, reload or reconnect, verify it persisted, then
// restore. This spec walks that procedure in a real browser over the three
// preferences that survive a reload, and doubles as the rehearsal for the
// Phase-8 MCP-driven run — each step writes the snapshot/screenshot pair the
// ES-12 evidence template asks for.
//
// The claimed list is src/preferences.ts. Log-console filters are deliberately
// EXCLUDED from it: nothing under src/pages/status/ persists them, so they
// reset on reload. ES-12 asks for the supported list AND the excluded items
// and tells the evaluator to record a missing feature as unavailable, so they
// are reported rather than claimed.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import fs from 'fs';
import path from 'path';

// ⚠ This file signs out, and `request_logout()` REVOKES the token server-side.
// Every other spec shares one admin token from `.auth/admin.json`, so signing
// out on that shared session poisons every spec that runs after this file —
// 26 failures and 81 tests never reached, the first time it happened. Own
// session: blank storage state plus one UI login. Same rule as session.spec.ts.
test.use({storageState: {cookies: [], origins: []}});

const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

const EVIDENCE_DIR = path.join('docs/internal/gs-cert/m1/ui-impl/evidence/UI-P6-6/es12-walkthrough');

const KEYS = {
	density: 'table_density',
	sideMenu: 'is_open_side_menu',
	language: 'language',
} as const;

/** One UI login into a fresh context — mirrors auth.setup.ts's flow. */
async function signIn(page: import('@playwright/test').Page) {
	await page.goto('login');
	await page.locator('#username').waitFor({state: 'visible', timeout: 20_000});
	await page.locator('#username').fill(ADMIN_USER);
	await page.locator('#password').fill(ADMIN_PASSWORD);
	await page.getByRole('button', {name: /^(Login|로그인|ログイン)$/}).click();
	await expect(page, 'preferences spec could not sign in').toHaveURL(/\/instance/, {timeout: 20_000});
}

/**
 * The density control, located by its ICON rather than its label.
 *
 * This spec switches the app to Korean halfway through, so any locator keyed
 * on an English accessible name stops matching exactly where the test gets
 * interesting. The icon reflects state: DensityMedium is shown while rows are
 * comfortable (click it to compact them), DensitySmall while they are compact.
 * Same data-testid hook e2e/helpers/table.ts uses.
 */
function densityToggle(page: import('@playwright/test').Page, current: 'comfortable' | 'compact') {
	const icon = current === 'compact' ? 'DensitySmallIcon' : 'DensityMediumIcon';
	return page.locator(`#table-bar button:has([data-testid="${icon}"])`).first();
}

/** The three claimed preferences, exactly as stored. */
async function readPreferences(page: import('@playwright/test').Page) {
	return page.evaluate(
		keys => ({
			density: localStorage.getItem(keys.density),
			sideMenu: localStorage.getItem(keys.sideMenu),
			language: localStorage.getItem(keys.language),
		}),
		KEYS,
	);
}

/**
 * The ES-12 evidence pair for one step. Written under the task's evidence
 * directory (gitignored) so the Phase-8 run has a known-good baseline to
 * compare against rather than a blank page.
 */
async function captureStep(page: import('@playwright/test').Page, step: string) {
	fs.mkdirSync(EVIDENCE_DIR, {recursive: true});
	// Wait for the page to settle first. SetupHandler probes the instance
	// before it renders anything, so capturing immediately catches its spinner:
	// the first version of this helper produced six 35-byte snapshots reading
	// `progressbar "Loading..."` and blank screenshots — evidence that proves
	// nothing, which is worse than no evidence because it looks complete.
	//
	// A single "no spinner" observation is not enough, and the second version
	// proved it: a language change calls navigate(0), so the poll saw zero
	// progressbars in the instant before the reload had even started one.
	// Require the absence to HOLD across consecutive observations instead —
	// page-agnostic, unlike a "body has enough text" heuristic, which the
	// sparse login screen fails outright. Each caller also waits for a signal
	// specific to its own step before getting here.
	await page.waitForLoadState('domcontentloaded');
	let settled = 0;
	await expect
		.poll(
			async () => {
				settled = (await page.getByRole('progressbar').count()) === 0 ? settled + 1 : 0;
				return settled;
			},
			{timeout: 30_000, intervals: [250], message: `page never finished rendering at step ${step}`},
		)
		.toBeGreaterThanOrEqual(4);
	await page.screenshot({path: path.join(EVIDENCE_DIR, `${step}.png`), fullPage: false});
	const snapshot = await page.locator('body').ariaSnapshot();
	fs.writeFileSync(path.join(EVIDENCE_DIR, `${step}.aria.txt`), snapshot);
}

/** Sign out through the profile menu (the trigger is a Box, not a button). */
async function signOut(page: import('@playwright/test').Page) {
	await page.locator('#profile').click();
	await page.getByRole('menuitem', {name: /sign out|로그아웃|サインアウト/i}).click();
	await page.getByRole('button', {name: /^(Yes|예|はい)$/}).click();
	await expect(page).toHaveURL(/\/login/, {timeout: 20_000});
}

/**
 * Ending a session makes in-flight requests answer 401 and the browser log the
 * failed fetch. That is the expected consequence of signing out, not a defect,
 * and whether it happens depends on timing — settle it deliberately rather
 * than leave it to luck. Same allowance session.spec.ts makes.
 */
function allowLogoutFetchNoise(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of 401/i);
}

let instName: string;

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

test('every claimed customization survives a reload and a re-login, then restores (ES-12)', async ({page, consoleGuard}) => {
	allowLogoutFetchNoise(consoleGuard);
	await signIn(page);
	await captureStep(page, '01-signed-in-defaults');

	//---------------------------------------------------------
	// 1. Change each customization through the UI
	//---------------------------------------------------------
	// Density: the toolbar toggle on any table. The instance LIST is a card
	// grid, not a table, so the walkthrough goes to a page that actually has
	// one — density is global, so which table is immaterial.
	await page.goto(`instance/traffic/lb?name=${instName}`);
	await expect(densityToggle(page, 'comfortable')).toBeVisible({timeout: 20_000});
	await densityToggle(page, 'comfortable').click();
	await expect.poll(async () => (await readPreferences(page)).density, {timeout: 10_000}).toBe(JSON.stringify('compact'));

	// Side menu: the hamburger in the top nav. The IconButton carries no
	// accessible name today (components/element/SimpleButton.tsx renders a bare
	// MenuIcon) — noted as an a11y observation for the ES-11/ES-13 sweep, and
	// located here by its icon rather than by role+name.
	await page.locator('button:has([data-testid="MenuIcon"])').first().click();
	await expect.poll(async () => (await readPreferences(page)).sideMenu, {timeout: 10_000}).toBe(JSON.stringify(false));

	// Language: the header selector.
	await page.locator('#language').click();
	await page.getByRole('menuitem').filter({hasText: '한국어'}).click();
	await expect.poll(async () => (await readPreferences(page)).language, {timeout: 10_000}).toBe('ko');

	const changed = await readPreferences(page);
	// The language change calls navigate(0); wait for the reload to have
	// actually applied it before capturing, or the evidence shows the old page.
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko', {timeout: 20_000});
	await captureStep(page, '02-customized');

	//---------------------------------------------------------
	// 2. Reload — the ES-12 persistence step
	//---------------------------------------------------------
	await page.reload();
	await expect(page).toHaveURL(/\/instance\/traffic\/lb/, {timeout: 20_000});
	expect(await readPreferences(page), 'a reload must not lose any claimed preference').toEqual(changed);
	// Proof the value is APPLIED and not merely stored: in Korean and compact,
	// the toggle offers the trip back.
	await expect(densityToggle(page, 'compact')).toBeVisible({timeout: 20_000});
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
	await captureStep(page, '03-after-reload');

	//---------------------------------------------------------
	// 3. Logout then login — the ES-12 "reconnect" step, and the
	//    cross-assertion against UI-P6-4's purge
	//---------------------------------------------------------
	await signOut(page);

	const afterLogout = await page.evaluate(
		keys => ({
			density: localStorage.getItem(keys.density),
			sideMenu: localStorage.getItem(keys.sideMenu),
			language: localStorage.getItem(keys.language),
			token: localStorage.getItem('access_token'),
			persistedCache: localStorage.getItem('REACT_QUERY_OFFLINE_CACHE'),
		}),
		KEYS,
	);
	// Preferences are not secrets — they are precisely what ES-12 wants kept.
	expect(afterLogout.density, 'logout must not purge a preference').toBe(changed.density);
	expect(afterLogout.sideMenu).toBe(changed.sideMenu);
	expect(afterLogout.language).toBe(changed.language);
	// The other direction, so "preferences survived" cannot be satisfied by a
	// purge that does nothing at all.
	expect(afterLogout.token, 'logout must purge the session token').toBeNull();
	expect(afterLogout.persistedCache, 'logout must purge the persisted query cache').toBeNull();
	// The login screen, fully rendered — not the redirect that gets there.
	await page.locator('#username').waitFor({state: 'visible', timeout: 20_000});
	await captureStep(page, '04-logged-out');

	await signIn(page);
	expect(await readPreferences(page), 'a re-login must not lose any claimed preference').toEqual(changed);
	// ES-12's decision rule makes a transition to /404 an outright FAIL, and
	// UI-P6-4's return-to-route lands the operator on the page they left — so
	// that page has to actually work when they get there.
	await expect(page, 'a re-login must not land the operator on /404').not.toHaveURL(/\/404/);
	await captureStep(page, '05-after-relogin');

	//---------------------------------------------------------
	// 4. Restore defaults — the ES-12 restore step
	//---------------------------------------------------------
	// Back to a page that has a table: re-login lands on the instance list
	// (or, thanks to UI-P6-4's return-to-route, wherever the session ended),
	// and neither is guaranteed to be the LB page.
	await page.goto(`instance/traffic/lb?name=${instName}`);
	await expect(densityToggle(page, 'compact')).toBeVisible({timeout: 20_000});
	await densityToggle(page, 'compact').click();
	await page.locator('button:has([data-testid="MenuIcon"])').first().click();
	await page.locator('#language').click();
	await page.getByRole('menuitem').filter({hasText: 'English'}).click();

	await expect.poll(async () => (await readPreferences(page)).language, {timeout: 10_000}).toBe('en');

	await page.reload();
	await expect(page).toHaveURL(/\/instance\/traffic\/lb/, {timeout: 20_000});
	const restored = await readPreferences(page);
	expect(restored.density, 'the restored default must persist too').toBe(JSON.stringify('comfortable'));
	expect(restored.sideMenu).toBe(JSON.stringify(true));
	expect(restored.language).toBe('en');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await captureStep(page, '06-restored');
});

test('a corrupt stored preference falls back to the default instead of being adopted (ES-12)', async ({page}) => {
	// The negative path, in a real browser. Before UI-P6-6 the hook adopted an
	// unparseable value as state — a density that is neither 'comfortable' nor
	// 'compact' — and then re-serialised it, so the bad value outlived the
	// session. Nothing throws either way, which is what made it worth pinning.
	await signIn(page);

	await page.goto(`instance/traffic/lb?name=${instName}`);
	await page.evaluate(keys => localStorage.setItem(keys.density, '{broken'), KEYS);
	await page.reload();
	await expect(page).toHaveURL(/\/instance\/traffic\/lb/, {timeout: 20_000});

	// Rendered as the default. ⚠ This assertion is NOT the guard: it passes on
	// the pre-fix hook too, because '{broken' is not 'compact' either, so the
	// table renders comfortable rows while holding a garbage value. Verified by
	// replaying this spec against the old behaviour.
	await expect(densityToggle(page, 'comfortable')).toBeVisible({timeout: 20_000});
	// The real proof: storage is repaired, so the next reload does not meet it
	// again. Pre-fix this failed with '"{broken"' — the value laundered into
	// valid JSON by the write effect, which is what made the corruption
	// permanent rather than a one-off.
	await expect.poll(async () => (await readPreferences(page)).density, {timeout: 10_000}).toBe(JSON.stringify('comfortable'));
});
