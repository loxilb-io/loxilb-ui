//---------------------------------------------------------
// Login result mapping on the sign-in screen: what the operator
// sees when a sign-in is refused.
//
//   • the OAM lockout (HTTP 429) renders a LOCALIZED locked-out message,
//     distinct from a plain bad password, with no raw server prose and no
//     retry-after policy detail (the conservative default)
//   • the same message in Korean (persisted `language` key)
//   • a plain bad password renders the localized invalid-credentials text
//
// The 429 cases use route interception with the VERBATIM OAM wire body
// (internal/handlers/handler.go Login) instead of hammering the live
// lockout: OAM locks per user+IP with exponential backoff AND rate-limits
// logins per IP (burst 10) — six live failures here would destabilize every
// later spec in the run (reproducibility rule). The wire shape itself is
// pinned by src/connector/user.login.test.ts against the same body, and a
// live-fire leg exists behind E2E_LIVE_LOCKOUT=1 for evidence runs.
//---------------------------------------------------------
import {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';

const LOCKOUT_BODY = JSON.stringify({
	error: 'Too many failed login attempts. Please try again later. Retry after 47 seconds.',
	retry_after_seconds: 47,
});

const EN_LOCKED = 'Too many failed sign-in attempts. Please try again later.';
const KO_LOCKED = '로그인 실패 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
const EN_INVALID = 'Invalid username or password.';

// Cross-origin POST to the OAM → the browser preflights and enforces CORS
// even on fulfilled routes; answer both legs.
async function fulfillLogin(route: Route, status: number, body: string): Promise<void> {
	const cors = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
	};
	if (route.request().method() === 'OPTIONS') {
		await route.fulfill({status: 204, headers: cors});
		return;
	}
	await route.fulfill({status, headers: {...cors, 'Content-Type': 'application/json'}, body});
}

async function submitLogin(page: Page, username: string, password: string): Promise<void> {
	await page.goto('login');
	await page.locator('#username').fill(username);
	await page.locator('#password').fill(password);
	await page.getByRole('button', {name: /Login|로그인/}).click();
}

test.describe('login result mapping (logged-out context)', () => {
	test.use({storageState: {cookies: [], origins: []}});

	test('lockout 429 → localized locked-out message, no raw prose, no retry-after detail', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of 429/i);
		await page.route('**/oam/login', r => fulfillLogin(r, 429, LOCKOUT_BODY));

		await submitLogin(page, 'operator', 'WrongPw!nope9');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toHaveText(EN_LOCKED);
		await expect(alert).not.toContainText('Retry after');
		await expect(alert).not.toContainText('Too many failed login attempts');
		// Distinct from the plain-failure message (: lockout must be
		// recognizable as lockout).
		await expect(alert).not.toHaveText(EN_INVALID);
		await expect(page).toHaveURL(/\/login/);
	});

	test('lockout message is Korean when the persisted language is ko', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of 429/i);
		await page.addInitScript(() => localStorage.setItem('language', 'ko'));
		await page.route('**/oam/login', r => fulfillLogin(r, 429, LOCKOUT_BODY));

		await submitLogin(page, 'operator', 'WrongPw!nope9');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible();
		await expect(alert).toHaveText(KO_LOCKED);
		// No English server prose leaks into the ko screen.
		await expect(alert).not.toContainText(/[A-Za-z]{4}/);
	});

	test('plain bad password (401, one live attempt) → localized invalid-credentials message', async ({page, consoleGuard}) => {
		// ONE live attempt against a nonexistent user — never hammer the live
		// lockout (see header comment).
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of 401/i);

		// Underscores only — AuthForm's client-side username validation
		// rejects hyphens before the request would even fire.
		await submitLogin(page, `e2e_no_such_user_${Date.now()}`, 'WrongPw!nope9');

		const alert = page.getByRole('alert');
		await expect(alert).toBeVisible({timeout: 15_000});
		await expect(alert).toHaveText(EN_INVALID);
		await expect(page).toHaveURL(/\/login/);
	});

	test('LIVE lockout: 6 wrong passwords → locked-out message from the real OAM', async ({page, consoleGuard}) => {
		test.skip(!process.env.E2E_LIVE_LOCKOUT, 'evidence-run only: consumes the per-IP login burst and trips a 1-minute lockout (set E2E_LIVE_LOCKOUT=1)');
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of (401|429)/i);

		const victim = `e2e_lockout_probe_${Date.now()}`;
		for (let i = 0; i < 5; i++) {
			await submitLogin(page, victim, 'WrongPw!nope9');
			await expect(page.getByRole('alert')).toBeVisible({timeout: 15_000});
		}
		// 6th attempt: OAM blocks (MaxFailedLoginAttempts=5).
		await submitLogin(page, victim, 'WrongPw!nope9');
		const alert = page.getByRole('alert');
		await expect(alert).toHaveText(EN_LOCKED, {timeout: 15_000});
		await expect(alert).not.toContainText('Retry after');
	});
});
