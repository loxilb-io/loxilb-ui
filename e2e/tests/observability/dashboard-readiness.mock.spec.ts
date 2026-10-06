//---------------------------------------------------------
// Dashboard — gateway readiness banner (RDY-E2E-01..04), mock contract layer.
//---------------------------------------------------------
// GET /diagnostics carries the gateway's own readiness verdict and the
// operator maintenance state. The dashboard shows them only when there is
// something to act on: "not ready" with the gateway's reasons, and
// "in maintenance". A healthy answer, and a gateway without the route, add
// nothing.
//
// ⭐ Only /diagnostics is intercepted. /version, flavor detection and the
// metrics scrape stay real, so the banner is mounted by the same flavor
// decision as on the testbed.
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

const DIAGNOSTICS_RE = /\/netlox\/v1\/diagnostics(\?.*)?$/;
const BOOT = {profile: 'strict', snapshot_found: false, succeeded: false, degraded: false, legacy_fallback: false};
const HEALTHY = {version: 'e2e', uptime_seconds: 60, ready: true, ready_reasons: [], maintenance_state: 'active', boot: BOOT};

let instName: string;

/** Answer /diagnostics; returns the live count of reads served. */
async function mockDiagnostics(page: Page, status: number, body: unknown = {}): Promise<{reads: number}> {
	const counter = {reads: 0};
	await page.route(DIAGNOSTICS_RE, (route: Route) => {
		counter.reads += 1;
		return route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
	});
	return counter;
}

/** Open the dashboard and wait until the diagnostics read has LANDED and the cards are up. */
async function openDashboard(page: Page) {
	const landed = page.waitForResponse(resp => DIAGNOSTICS_RE.test(new URL(resp.url()).pathname));
	await page.goto(`instance/dashboard?name=${encodeURIComponent(instName)}`);
	await landed;
	await expect(page.locator('#content-area').getByRole('heading', {name: 'Dashboard'})).toBeVisible();
	// The persistence card reads the same answer: once it is up, so is the banner's input.
	await expect(page.getByText('Config Persistence')).toBeVisible();
	return page.getByTestId('gateway-readiness');
}

test.describe('@gw Dashboard — gateway readiness banner (mock)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('RDY-E2E-01: a ready gateway in normal operation shows no banner', async ({page}) => {
		const counter = await mockDiagnostics(page, 200, HEALTHY);
		const banner = await openDashboard(page);
		expect(counter.reads, 'the stubbed diagnostics read was served').toBeGreaterThan(0);
		await expect(banner).toHaveCount(0);
		await expect(page.getByText(/reports it is not ready|is in maintenance/)).toHaveCount(0);
	});

	test('RDY-E2E-02: a gateway that is not ready shows one error with its own reasons', async ({page}) => {
		const reasons = ['boot config replay has not settled', 'dependency etcd: context deadline exceeded'];
		const counter = await mockDiagnostics(page, 200, {...HEALTHY, ready: false, ready_reasons: reasons});
		const banner = await openDashboard(page);
		expect(counter.reads).toBeGreaterThan(0);
		const alerts = banner.getByRole('alert');
		await expect(alerts).toHaveCount(1);
		await expect(alerts).toContainText(`This gateway reports it is not ready: ${reasons.join('; ')}`);
		await expect(banner.getByText(/is in maintenance/)).toHaveCount(0);
	});

	test('RDY-E2E-03: operator maintenance is one warning on an otherwise ready gateway', async ({page}) => {
		const counter = await mockDiagnostics(page, 200, {...HEALTHY, maintenance_state: 'maintenance'});
		const banner = await openDashboard(page);
		expect(counter.reads).toBeGreaterThan(0);
		const alerts = banner.getByRole('alert');
		await expect(alerts).toHaveCount(1);
		await expect(alerts).toContainText('This gateway is in maintenance. It refuses configuration changes until an operator ends the maintenance.');
		await expect(banner.getByText(/not ready/)).toHaveCount(0);
	});

	test('RDY-E2E-04: a gateway without the readiness fields, or without the route, shows no banner', async ({page, consoleGuard}) => {
		// The fields entered the gateway together; an answer without them says nothing.
		let counter = await mockDiagnostics(page, 200, {version: 'e2e', boot: BOOT});
		let banner = await openDashboard(page);
		expect(counter.reads).toBeGreaterThan(0);
		await expect(banner).toHaveCount(0);

		await page.unrouteAll();
		consoleGuard.allowRequest({status: 404, path: /\/netlox\/v1\/diagnostics$/});
		counter = await mockDiagnostics(page, 404, {code: 404, message: 'not found'});
		banner = await openDashboard(page);
		expect(counter.reads).toBeGreaterThan(0);
		await expect(banner).toHaveCount(0);
		await expect(page.getByText(/reports it is not ready|is in maintenance/)).toHaveCount(0);
	});
});
