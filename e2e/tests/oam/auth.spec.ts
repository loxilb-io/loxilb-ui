//---------------------------------------------------------
// OAM auth spec (docs/E2E_CRUD_TEST_PLAN.md §7).
//   • wrong-password → in-page error, never leaves /login (single attempt —
//     the OAM applies an exponential per-user lockout, so we never hammer it)
//   • login ok → /instance
//   • logout confirm → back to /login, local token cleared
//   • H-2: the token the logged-out session held is revoked server-side; a
//     replay of it against /users/me returns 401 (verified per-token, so the
//     shared admin.json session is untouched — this test logs in fresh)
//   • deep-link while authed → a protected route renders, not bounced to login
//
// The login/logout tests run WITHOUT the stored admin session (fresh context)
// so signing out only revokes their own freshly-minted token.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {OAM_BASE} from '../../helpers/api';
import {dialogButton, dialogTitle} from '../../helpers/dialogs';

const ADMIN_USER = process.env.E2E_ADMIN_USER!;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!;

async function meStatus(token: string): Promise<number> {
	const r = await fetch(`${OAM_BASE}/users/me`, {headers: {Authorization: `Bearer ${token}`, Accept: 'application/json'}});
	return r.status;
}

test.describe('OAM auth — login & logout (logged-out context)', () => {
	// No stored session — start every test at the login screen.
	test.use({storageState: {cookies: [], origins: []}});

	test('wrong password surfaces an error and never leaves /login', async ({page, consoleGuard}) => {
		// Chrome logs failed fetches to the console; the 401 is the point of the test.
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of 40[13]/i);

		await page.goto('login');
		await page.locator('#username').fill(ADMIN_USER);
		await page.locator('#password').fill('WrongPw!nope9'); // valid format, wrong credential
		await page.getByRole('button', {name: 'Login'}).click();

		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);
		await expect(page).not.toHaveURL(/\/instance/);
	});

	test('login ok, logout confirm clears the session, replayed token is revoked (H-2)', async ({page, consoleGuard}) => {
		// Logout clears the token then redirects; an in-flight /users/me poll can
		// land a benign 401 as React Query settles.
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of 401/i);

		await page.goto('login');
		await page.locator('#username').fill(ADMIN_USER);
		await page.locator('#password').fill(ADMIN_PASSWORD);
		await page.getByRole('button', {name: 'Login'}).click();
		await expect(page).toHaveURL(/\/instance/, {timeout: 20_000});

		const token = await page.evaluate(() => localStorage.getItem('access_token'));
		expect(token, 'access_token stored after login').toBeTruthy();
		expect(await meStatus(token!), 'fresh token is live').toBe(200);

		// Sign out via the header profile menu → "Sign out" → confirm popup.
		await page.locator('#profile').click();
		await page.getByRole('menuitem', {name: /Sign out/i}).click();
		await expect(dialogTitle(page, 'Sign out')).toBeVisible();
		await dialogButton(page, 'Yes').click();

		await expect(page).toHaveURL(/\/login/, {timeout: 20_000});
		expect(await page.evaluate(() => localStorage.getItem('access_token')), 'local token cleared on logout').toBeNull();

		// H-2: server-side revocation — the old token no longer authenticates.
		expect(await meStatus(token!), 'logged-out token is revoked (H-2)').toBe(401);
	});
});

test.describe('OAM auth — deep link while authenticated', () => {
	// Inherits the project default admin session (.auth/admin.json).
	test('direct navigation to a protected route renders, not bounced to /login', async ({page}) => {
		await page.goto('user');
		await expect(page).toHaveURL(/\/user/);
		await expect(page).not.toHaveURL(/\/login/);
		// Content actually rendered → RequireAuth passed and the token is valid.
		await expect(page.getByText('Profile Information')).toBeVisible({timeout: 20_000});
	});
});
