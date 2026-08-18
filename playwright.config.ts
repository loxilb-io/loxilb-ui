//---------------------------------------------------------
// Playwright config for the per-page CRUD E2E suite
// (see docs/E2E_RUNNING.md). Runs against the local dev
// server + a live testbed gateway, so mutations are
// serialized: workers=1, no parallelism, no retries that
// could double-fire a create.
//---------------------------------------------------------
import {defineConfig, devices} from '@playwright/test';
import * as dotenv from 'dotenv';

// Testbed admin credentials (E2E_ADMIN_USER / E2E_ADMIN_PASSWORD)
dotenv.config({path: '.env.e2e.local'});

// Dev-server port. Overridable (E2E_UI_PORT) because 3000 is a popular
// default — e.g. an active Grafana SSH forward silently serves a foreign app
// there and reuseExistingServer happily runs the suite against it.
const UI_PORT = process.env.E2E_UI_PORT ?? '3000';

// Two backend products, two suites (see e2e/oss/CLAUDE.md):
//
//   project 'gw'  — e2e/tests/**    → loxilb-inference-gateway   (npm run e2e)
//   project 'oss' — e2e/oss/tests/** → plain upstream loxilb      (npm run e2e-oss)
//
// They are separate spec trees rather than one tagged suite because the two
// backends have genuinely different semantics on the shared /netlox/v1 base
// (no PATCH upstream, 409 on a duplicate POST, connect-only probes, narrower
// sel/security enums, no /logs cursor, different Prometheus names). Branching
// on flavor inside one spec made those assertions unreadable and let a spec
// edited for a gateway feature silently change what ran against loxilb.
//
// What they DO share: the harness (e2e/fixtures.ts, e2e/helpers/**) and the
// login/setup project — and the OAM-side specs (tests/oam/**), which exercise
// the OAM rather than either backend and so are never duplicated.
//
// '@gw' tags survive inside the gateway tree as documentation of which cases
// are gateway-only; selection no longer depends on them.

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
		baseURL: `http://localhost:${UI_PORT}/netlox/`,
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
			// Self-tests for the shared e2e helpers. No app, no testbed, no auth: they
			// drive hand-built pages via setContent, so they carry no 'setup'
			// dependency and are excluded from both product legs on purpose.
			name: 'selftest',
			testDir: 'e2e/selftest',
			testMatch: /.*\.spec\.ts/,
			use: {...devices['Desktop Chrome']},
		},
		{
			// loxilb-inference-gateway suite. Also owns the OAM-side specs.
			name: 'gw',
			testDir: 'e2e/tests',
			testMatch: /.*\.spec\.ts/,
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				viewport: {width: 1280, height: 900},
				storageState: '.auth/admin.json',
			},
		},
		{
			// loxilb-oss (plain upstream loxilb) suite. Every spec here asserts
			// upstream semantics and fails fast if the pinned instance turns out
			// to be a gateway (e2e/oss/_loxilb.ts requireLoxilbInstance).
			name: 'oss',
			testDir: 'e2e/oss/tests',
			testMatch: /.*\.spec\.ts/,
			dependencies: ['setup'],
			use: {
				...devices['Desktop Chrome'],
				viewport: {width: 1280, height: 900},
				storageState: '.auth/admin.json',
			},
		},
	],

	// The helper self-tests drive hand-built pages and never load the app, so
	// booting a dev server for them would cost ~a minute and buy nothing.
	webServer: process.env.E2E_NO_WEBSERVER
		? undefined
		: {
				// HTTP on purpose: the OAM endpoint is plain http, and an https dev
				// server would hit the browser's mixed-content block.
				command: `PORT=${UI_PORT} HTTPS=false BROWSER=none WDS_SOCKET_PORT=0 dotenv -e .env.development react-scripts start`,
				url: `http://localhost:${UI_PORT}/netlox/`,
				reuseExistingServer: true,
				timeout: 180_000,
			},
});
