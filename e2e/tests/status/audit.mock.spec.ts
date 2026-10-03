//---------------------------------------------------------
// System page — audit trail REST signals (AUD-E2E-01..06), mock contract layer.
//---------------------------------------------------------
// The audit writer section reads Prometheus; the gateway's /audit/status and
// /audit/sink add only what the metrics cannot say, and only when urgent: a
// configured sink that is not connected, and the latest orphaned event id. A
// healthy answer adds nothing. 403 is a quiet note, 404 (an older gateway) is
// silence, and the read polls only while the page is open.
//
// ⭐ Only /audit/* is intercepted. /version, flavor detection and the metrics
// scrape stay real, so the section renders exactly as it does on the testbed.
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

const STATUS_RE = /\/netlox\/v1\/audit\/status(\?.*)?$/;
const SINK_RE = /\/netlox\/v1\/audit\/sink(\?.*)?$/;

const HEALTHY = {available: true, running: true, boot_id: 'e2e-boot', seq_high: 42};

let instName: string;

type Answer = {status: number; body?: unknown};

/** Answer /audit/status and /audit/sink; returns the live count of status reads. */
async function mockAudit(page: Page, status: Answer, sink: Answer = {status: 200, body: {}}): Promise<{reads: number}> {
	const counter = {reads: 0};
	await page.route(STATUS_RE, (route: Route) => {
		counter.reads += 1;
		return route.fulfill({status: status.status, contentType: 'application/json', body: JSON.stringify(status.body ?? {})});
	});
	await page.route(SINK_RE, (route: Route) =>
		route.fulfill({status: sink.status, contentType: 'application/json', body: JSON.stringify(sink.body ?? {})}),
	);
	return counter;
}

/** Open the System page with the gateway picked, and wait until the audit read has LANDED. */
async function openAuditSection(page: Page) {
	await page.addInitScript(name => localStorage.setItem('system_audit_instance', JSON.stringify(name)), instName);
	const landed = page.waitForResponse(resp => STATUS_RE.test(new URL(resp.url()).pathname));
	await page.goto('system');
	await landed;
	const heading = page.getByRole('heading', {name: 'Gateway audit writer'});
	await expect(heading).toBeVisible();
	const section = heading.locator('xpath=ancestor::div[2]');
	// The metrics half has rendered: one of its terminal states is on screen.
	await expect(section.getByText(/^Writer$|Audit writer health is unavailable|does not export audit writer metrics|No audit writer is running/).first()).toBeVisible();
	return section;
}

test.describe('@gw System page — audit REST signals (mock)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('AUD-E2E-01: a healthy REST answer adds nothing to the section', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 404, path: /\/audit\/status$/});
		// Baseline: the same page with the REST surface absent (older gateway).
		await mockAudit(page, {status: 404});
		const bare = await openAuditSection(page);
		const baselineAlerts = await bare.getByRole('alert').count();

		await page.unrouteAll();
		await mockAudit(page, {status: 200, body: HEALTHY}, {status: 200, body: {}});
		const healthy = await openAuditSection(page);
		await expect(healthy.getByRole('alert')).toHaveCount(baselineAlerts);
		await expect(healthy.getByText(/audit sink|orphan|administrator rights/i)).toHaveCount(0);
		// The DOM-level "identical to no REST at all" guard is the unit test
		// (AuditWriterPanel.test.tsx): the live metrics half ticks, so a page
		// snapshot comparison here would measure the gateway, not the UI.
	});

	test('AUD-E2E-02: a configured sink that is not connected is one warning with its error', async ({page}) => {
		await mockAudit(page, {status: 200, body: HEALTHY}, {
			status: 200,
			body: {enabled: true, address: 'siem.example:6514', last_error: 'x509: certificate signed by unknown authority', write_errors: 4},
		});
		const section = await openAuditSection(page);
		const warning = section.getByRole('alert').filter({hasText: 'is configured but not connected'});
		await expect(warning).toHaveCount(1);
		await expect(warning).toContainText('siem.example:6514');
		await expect(warning).toContainText('x509: certificate signed by unknown authority');
		await expect(warning).toContainText('4 submissions have failed since it was configured.');
	});

	test('AUD-E2E-03: the latest orphaned intent is named by its event id', async ({page}) => {
		await mockAudit(page, {status: 200, body: {...HEALTHY, orphaned_intents: 2, last_orphan_event_id: 'evt-01a0e6dc'}});
		const section = await openAuditSection(page);
		// The metrics' orphan fault line carries it when that counter is up;
		// otherwise it stands alone. Either way the id is on screen.
		await expect(section.getByText(/evt-01a0e6dc/)).toBeVisible();
	});

	test('AUD-E2E-04: a 403 is a quiet note, not an error, and the metrics half still renders', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 403, path: /\/audit\/status$/});
		const counter = await mockAudit(page, {status: 403, body: {code: 403, message: 'forbidden'}});
		const section = await openAuditSection(page);
		await expect(section.getByText('Audit sink and orphan details need gateway administrator rights.')).toBeVisible();
		await expect(section.getByRole('alert').filter({hasText: /administrator|forbidden|403/i})).toHaveCount(0);
		await expect(page.getByText(/Something went wrong|failed to load/i)).toHaveCount(0);
		// A refusal is final: not retried. The retry delay is 3 s, so a retry
		// would have landed inside this window.
		await page.waitForTimeout(4_000);
		expect(counter.reads).toBe(1);
	});

	test('AUD-E2E-05: a gateway without the audit API (404) shows no REST rows and no error', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 404, path: /\/audit\/status$/});
		const counter = await mockAudit(page, {status: 404});
		const section = await openAuditSection(page);
		await expect(section.getByText(/audit sink|orphan|administrator rights/i)).toHaveCount(0);
		expect(page.url()).toMatch(/\/system/);
		expect(counter.reads).toBe(1);
	});

	test('AUD-E2E-06: the read polls while the page is open and stops when it is left', async ({page}) => {
		await page.clock.install();
		const counter = await mockAudit(page, {status: 200, body: HEALTHY});
		await openAuditSection(page);
		expect(counter.reads).toBe(1);

		// On the page: one more read per 30 s cadence.
		await page.clock.fastForward(31_000);
		await expect.poll(() => counter.reads).toBe(2);

		// Leave the page: two more cadences, no more reads.
		await page.goto('instance');
		const before = counter.reads;
		await page.clock.fastForward(31_000);
		await page.clock.fastForward(31_000);
		// Give any stray timer a real chance to fire before judging silence.
		await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(null))));
		expect(counter.reads).toBe(before);
	});
});
