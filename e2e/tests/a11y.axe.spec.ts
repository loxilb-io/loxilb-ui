//---------------------------------------------------------
// Route-level axe accessibility pass.
//
// Complements the component-level checks in src/a11y.test.tsx (which
// jsdom cannot take further: no layout → no color-contrast, no page
// landmark structure). Runs axe over representative routes and fails
// on any violation of a rule that is not in the frozen baseline below.
//
// BASELINE (counted 2026-08-31): the rules listed are known, existing
// debt — icon-only buttons without accessible names, theme color
// contrast, MUI Tooltip aria on non-interactive hosts, and layout
// list/landmark structure. They are frozen so a NEW class of violation
// fails immediately; the baseline itself is burned down separately and
// every entry removed here must stay removed.
//---------------------------------------------------------
import {AxeBuilder} from '@axe-core/playwright';
import {expect, test} from '../fixtures';
import {activeInstance} from '../helpers/api';

// Burned down 2026-09-08: aria-prohibited-attr, button-name, image-alt,
// link-name, list, landmark-one-main, region, heading-order — fixed at the
// source (Tooltip aria placement, icon-button labels, img alts, nav/list
// structure, header/main/footer landmarks, figure headings demoted to <p>).
// Burned down 2026-09-09: color-contrast — fixed in the design tokens
// (success/warning darkened to AA, brand orange given a dark label and an
// AA text step) rather than per node, so pages built later inherit it.
// src/theme.test.ts pins those ratios arithmetically, which is the check
// this route pass cannot be: axe only sees the combinations that happen to
// be on screen. Every rule listed above must stay removed.
const BASELINE_RULES = new Set([
	'page-has-heading-one', // pages title with h5; an h1 needs an app-wide heading renumber
]);

async function expectNoNewViolations(page: import('@playwright/test').Page) {
	// The app shell (SetupHandler) briefly renders outside Layout's landmarks;
	// analyzing that transient state false-fails landmark-one-main/region.
	await expect(page.getByRole('main')).toBeVisible();
	const results = await new AxeBuilder({page}).analyze();
	const fresh = results.violations.filter(v => !BASELINE_RULES.has(v.id));
	const report = fresh.map(v => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.map(n => n.target.join(' ')).join('; ')}`).join('\n');
	expect(fresh, report).toHaveLength(0);
}

test.describe('axe route pass (unauthenticated)', () => {
	// The suite's storageState is authenticated, which makes /login bounce to
	// /instance mid-analysis — this block runs logged out instead.
	test.use({storageState: {cookies: [], origins: []}});

	test('login page', async ({page}) => {
		await page.goto('login');
		await expect(page.getByRole('button', {name: /sign in|login/i})).toBeVisible();
		await expectNoNewViolations(page);
	});
});

test.describe('axe route pass', () => {
	test('instance list', async ({page, consoleGuard}) => {
		// The testbed OAM's registration list includes dead instances whose
		// status probes 502 — ambient environment state, not an app defect.
		consoleGuard.allow(/Failed to load resource.*502/);
		await page.goto('instance');
		await page.waitForLoadState('networkidle');
		await expectNoNewViolations(page);
	});

	test('LB rule page (heaviest DataGrid)', async ({page}) => {
		const inst = await activeInstance();
		await page.goto(`instance/traffic/lb?name=${encodeURIComponent(inst.name)}`);
		await page.waitForLoadState('load');
		await page.waitForTimeout(2000);
		await expectNoNewViolations(page);
	});

	test('log console', async ({page}) => {
		const inst = await activeInstance();
		await page.goto(`instance/status/logs?name=${encodeURIComponent(inst.name)}`);
		await page.waitForLoadState('load');
		await page.waitForTimeout(2000);
		await expectNoNewViolations(page);
	});

	// Observability surface (UI-MON-015): each page renders live panels fed
	// by the shared snapshot; the axe pass must see them with data mounted.
	for (const route of ['ai', 'workers', 'pdkv', 'security', 'qos', 'persistence']) {
		test(`observability ${route}`, async ({page, consoleGuard}) => {
			// A testbed gateway older than the vendored contract 404s
			// /diagnostics; the page degrades in-page (see viewports.spec.ts).
			if (route === 'persistence') consoleGuard.allow(/Failed to load resource.*404/);
			const inst = await activeInstance();
			await page.goto(`instance/observability/${route}?name=${encodeURIComponent(inst.name)}`);
			await page.waitForLoadState('load');
			await page.waitForTimeout(2000);
			await expectNoNewViolations(page);
		});
	}
});
