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
import {openToolbarDialog} from '../helpers/dialogs';

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
// Burned down 2026-09-18: page-has-heading-one — every route now carries one
// visually-hidden <h1> named from the route (components/layout/RouteTitle
// `PageHeading`), the menu's entries stopped entering the outline as headings,
// and section/panel titles became h2 so the outline descends h1 -> h2 without
// the four-level skip `heading-order` forbids. Every rule listed above must
// stay removed.
//
// ⭐ THE BASELINE IS NOW EMPTY, which is the point: any violation of any rule,
// on any route below, fails this test.
const BASELINE_RULES = new Set<string>([]);

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

//---------------------------------------------------------
// Heading outline, across far more routes than the full pass visits
//---------------------------------------------------------
// The full axe pass above is expensive (live panels, settled data) so it
// visits a dozen representative routes. The heading outline, though, is what
// Stage 5.2 changed app-wide, and a skipped level is invisible until someone
// cycles headings with a screen reader.
//
// ⭐ This block therefore trades depth for breadth: three rules only, but over
// every page family in the app, including the ones with no live data and the
// ones reached only by a wrong URL. It is the check that would have caught the
// sites the route pass above cannot see — a "Health Status" left at h6 under
// the page's h2, a dialog title that stopped being a heading at all.
const HEADING_RULES = ['page-has-heading-one', 'heading-order', 'empty-heading'];

// This sweep visits pages the rest of the suite never loads, so it meets every
// way the testbed is narrower than the contract: a gateway with no BGP
// configured answers its policy reads 403, /diagnostics is 404 on one older
// than the vendored spec, an unreachable box 502s. Those are environment, not
// app defects — and a page that degraded on a failed read still owes the
// visitor a sane heading outline, which is the only thing asserted here.
const ROUTE_NOISE = /Failed to load resource.*(40[34]|50[023])/;

// ⚠️ `ready` is a parameter because the modal case has no `main` to wait for:
// MUI marks the rest of the document aria-hidden while a dialog is open, so the
// landmark every other case uses as its readiness signal is deliberately absent
// there and the dialog itself is what proves the page settled.
async function expectSaneOutline(page: import('@playwright/test').Page, ready?: import('@playwright/test').Locator) {
	await expect(ready ?? page.getByRole('main')).toBeVisible();
	const results = await new AxeBuilder({page}).withRules(HEADING_RULES).analyze();
	const report = results.violations
		.map(v => `${v.id}: ${v.help} → ${v.nodes.map(n => n.target.join(' ')).join('; ')}`)
		.join('\n');
	expect(results.violations, report).toHaveLength(0);
}

test.describe('heading outline', () => {
	// Routes outside an instance take no ?name=.
	for (const route of ['instance', 'system', 'user']) {
		test(`/${route}`, async ({page, consoleGuard}) => {
			consoleGuard.allow(ROUTE_NOISE);
			await page.goto(route);
			await page.waitForLoadState('networkidle');
			await expectSaneOutline(page);
		});
	}

	// One page per family, plus the two BGP pages — routed but absent from the
	// drawer, so nothing else in the suite would ever load them.
	const INSTANCE_ROUTES = [
		'dashboard',
		'settings',
		'traffic/lb',
		'traffic/qos',
		'ai/apikey',
		'network/port',
		'network/bgp/global',
		'network/bgp/apply',
		'security/ipfilter',
		'status/device',
		'status/fs',
		'status/ha',
		'status/process',
		// A wrong sub-route renders Page404 inside the instance shell. The URL
		// stays under /instance, so the fixture's "never bounced to an error
		// route" guard is not tripped — which is the point: this is the 404 a
		// visitor actually meets.
		'no-such-page',
	];
	for (const route of INSTANCE_ROUTES) {
		test(`/instance/${route}`, async ({page, consoleGuard}) => {
			consoleGuard.allow(ROUTE_NOISE);
			const inst = await activeInstance();
			await page.goto(`instance/${route}?name=${encodeURIComponent(inst.name)}`);
			await page.waitForLoadState('load');
			await page.waitForTimeout(1500);
			await expectSaneOutline(page);
		});
	}

	test('with a dialog open', async ({page}) => {
		// Dialogs were never in the outline check, and their titles are the one
		// heading ten specs locate them by (components/layout/NewBox).
		const inst = await activeInstance();
		await page.goto(`instance/traffic/lb?name=${encodeURIComponent(inst.name)}`);
		await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
		await expectSaneOutline(page, page.getByRole('heading', {name: 'Add Load Balancer Rule'}));
	});
});
