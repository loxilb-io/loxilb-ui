//---------------------------------------------------------
// One real UI login per run per role → storageState files.
// The OAM rate-limits logins (burst 10/IP) and applies an
// exponential per-user lockout on failures, so this is the
// only place the suite ever touches /oam/login.
//---------------------------------------------------------
import {expect, test as setup} from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../.auth');

setup('authenticate as admin', async ({page}) => {
	const user = process.env.E2E_ADMIN_USER;
	const password = process.env.E2E_ADMIN_PASSWORD;
	if (!user || !password) throw new Error('E2E_ADMIN_USER / E2E_ADMIN_PASSWORD missing — set them in .env.e2e.local');

	await page.goto('login'); // relative — see baseURL note in playwright.config.ts
	await page.locator('#username').fill(user);
	await page.locator('#password').fill(password);
	await page.getByRole('button', {name: 'Login'}).click();

	// Successful login lands on the instance list; anything else (error
	// alert, lockout) must fail fast so we don't burn login-rate budget.
	await expect(page).toHaveURL(/\/instance/, {timeout: 20_000});

	fs.mkdirSync(AUTH_DIR, {recursive: true});
	await page.context().storageState({path: path.join(AUTH_DIR, 'admin.json')});
});
