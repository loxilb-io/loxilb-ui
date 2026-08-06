//---------------------------------------------------------
// Playwright config for the per-page CRUD E2E suite
// (docs/E2E_CRUD_TEST_PLAN.md). Runs against the local dev
// server + the live kv-client testbed gateway, so mutations
// are serialized: workers=1, no parallelism, no retries that
// could double-fire a create.
//---------------------------------------------------------
import {defineConfig, devices} from '@playwright/test';
import * as dotenv from 'dotenv';

// Testbed admin credentials (E2E_ADMIN_USER / E2E_ADMIN_PASSWORD)
dotenv.config({path: '.env.e2e.local'});

export default defineConfig({
	testDir: 'e2e',
	outputDir: 'test-results',
	// Shared live gateway: a parallel run would interleave mutations and
	// trip the OAM login rate limiter. Everything is serial by design.
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: !!process.env.CI,
	timeout: 120_000,
	expect: {timeout: 10_000},
	reporter: [['list'], ['html', {open: 'never'}]],

	use: {
		// Trailing slash matters: page.goto() joins with `new URL(path, baseURL)`,
		// so navigations must use RELATIVE paths ('login', 'instance/…') — a
		// leading '/' would resolve outside the /netlox base.
		baseURL: 'http://localhost:3000/netlox/',
		// IPsec/LB dialogs clip their action buttons below ~741px viewport
		// height (plan §11.1) — keep the test viewport tall enough.
		viewport: {width: 1280, height: 900},
		actionTimeout: 15_000,
		navigationTimeout: 30_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},

	projects: [
		// Logs in once per run and saves storageState — OAM rate-limits
		// logins (burst 10/IP + per-user lockout), so specs never log in
		// themselves.
		// Retries here only: every other project depends on this one, so a
		// single transient (a dropped response on the WAN path to the testbed)
		// otherwise aborts the entire run — 264 tests reported as "did not
		// run". Safe to repeat: setup logs in and provisions the two RBAC
		// fixtures idempotently, it mutates no gateway state. The global
		// retries:0 still stands for the mutating specs.
		{name: 'setup', testMatch: /auth\.setup\.ts/, retries: 2},
		{
			name: 'admin',
			testMatch: /tests\/.*\.spec\.ts/,
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				viewport: {width: 1280, height: 900},
				storageState: '.auth/admin.json',
			},
		},
	],

	webServer: {
		// HTTP on purpose: the OAM endpoint is plain http, and an https dev
		// server would hit the browser's mixed-content block.
		command: 'HTTPS=false BROWSER=none WDS_SOCKET_PORT=0 dotenv -e .env.development react-scripts start',
		url: 'http://localhost:3000/netlox/',
		reuseExistingServer: true,
		timeout: 180_000,
	},
});
