//---------------------------------------------------------
// One real UI login per role per run → storageState files.
// The OAM rate-limits logins (burst 10/IP) and applies an
// exponential per-user lockout on failures, so this is the
// only place the suite ever touches /oam/login. Three logins
// (admin, operator, viewer) stay well under the burst budget.
//
// The operator/viewer RBAC fixtures are provisioned once via
// the admin API (idempotent) so rbac.spec.ts has real non-admin
// sessions to assert against. They are persistent — zz-cleanup
// never sweeps them (their usernames are underscore-based, not
// the `e2e-` hyphen marker the sweeps match).
//---------------------------------------------------------
import {expect, test as setup} from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../.auth');
// Environment-only, like every address/credential in this suite — the repo
// never carries a reachable host or a live password.
const OAM_BASE = process.env.E2E_OAM_URL;
if (!OAM_BASE) throw new Error('E2E_OAM_URL missing — set it in .env.e2e.local (e.g. http://<oam-host>:8080/oam)');
const FIXTURE_PASSWORD = process.env.E2E_FIXTURE_PASSWORD;
if (!FIXTURE_PASSWORD) throw new Error('E2E_FIXTURE_PASSWORD missing — set it in .env.e2e.local (used for the auto-provisioned e2e_operator/e2e_viewer accounts)');

// Fixed RBAC fixture accounts, provisioned by the admin setup below with the
// password from the environment. Usernames use `_` (the validator forbids
// `-`), so they never match the `e2e-` sweep marker and survive cleanup.
export const FIXTURES = {
	operator: {username: 'e2e_operator', email: 'e2e_operator@test.local', password: FIXTURE_PASSWORD, role: 'operator'},
	viewer: {username: 'e2e_viewer', email: 'e2e_viewer@test.local', password: FIXTURE_PASSWORD, role: 'viewer'},
} as const;

function adminTokenFrom(stateFile: string): string {
	const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
	for (const origin of state.origins ?? []) {
		for (const entry of origin.localStorage ?? []) {
			if (entry.name === 'access_token' && entry.value) return entry.value;
		}
	}
	throw new Error(`No access_token in ${stateFile}`);
}

// Transient WAN resets to the testbed can kill a single Node fetch
// (ECONNRESET killed a whole 257-test run at this exact spot). The
// provisioning POST is idempotent, so retry briefly before failing the run —
// a genuinely dead OAM still fails after the retries.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
	let lastErr: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await fetch(url, init);
		} catch (err) {
			lastErr = err;
			await new Promise(r => setTimeout(r, 1000 * (i + 1)));
		}
	}
	throw lastErr;
}

async function uiLogin(page: import('@playwright/test').Page, username: string, password: string, stateName: string) {
	await page.goto('login'); // relative — see baseURL note in playwright.config.ts
	await page.locator('#username').fill(username);
	await page.locator('#password').fill(password);
	await page.getByRole('button', {name: 'Login'}).click();
	// Successful login lands on the instance list; anything else (error
	// alert, lockout) must fail fast so we don't burn login-rate budget.
	await expect(page, `login as ${username} did not reach /instance`).toHaveURL(/\/instance/, {timeout: 20_000});
	fs.mkdirSync(AUTH_DIR, {recursive: true});
	await page.context().storageState({path: path.join(AUTH_DIR, stateName)});
}

setup('authenticate as admin', async ({page}) => {
	const user = process.env.E2E_ADMIN_USER;
	const password = process.env.E2E_ADMIN_PASSWORD;
	if (!user || !password) throw new Error('E2E_ADMIN_USER / E2E_ADMIN_PASSWORD missing — set them in .env.e2e.local');

	await uiLogin(page, user, password, 'admin.json');

	// Provision the RBAC fixtures via the admin API (idempotent: a 409/400
	// "already exists" is fine — we just need to be able to log in as them).
	const token = adminTokenFrom(path.join(AUTH_DIR, 'admin.json'));
	for (const f of [FIXTURES.operator, FIXTURES.viewer]) {
		const resp = await fetchWithRetry(`${OAM_BASE}/users`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}`},
			body: JSON.stringify({username: f.username, email: f.email, password: f.password, role: f.role}),
		});
		if (!resp.ok && resp.status !== 409) {
			const body = await resp.text();
			// A duplicate-username 400 is the expected re-run path; anything else is fatal.
			if (!/exist|duplicate|already/i.test(body)) {
				throw new Error(`Provisioning ${f.username} failed: ${resp.status} ${body}`);
			}
		}
	}
});

setup('authenticate as operator', async ({page}) => {
	await uiLogin(page, FIXTURES.operator.username, FIXTURES.operator.password, 'operator.json');
});

setup('authenticate as viewer', async ({page}) => {
	await uiLogin(page, FIXTURES.viewer.username, FIXTURES.viewer.password, 'viewer.json');
});
