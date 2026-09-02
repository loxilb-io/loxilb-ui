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

const BASELINE_RULES = new Set([
	'aria-prohibited-attr', // MUI Tooltip title on non-interactive elements
	'button-name', // icon-only buttons in tables/toolbars
	'color-contrast', // theme palette vs white text
	'image-alt', // instance-card logo
	'link-name', // icon-only footer/header links
	'list', // MUI List renders non-li children
	'landmark-one-main', // page shell predates landmark structure
	'page-has-heading-one',
	'region',
	'heading-order',
]);

async function expectNoNewViolations(page: import('@playwright/test').Page) {
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
});
