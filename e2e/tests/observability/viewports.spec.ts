//---------------------------------------------------------
// Observability responsive gate (UI-MON-015): 4 viewports × 6 pages.
//
// Two invariants per page/viewport pair:
//   1. the page heading renders (the route actually mounted, not a blank
//      content area or a crashed frame);
//   2. the document body never scrolls horizontally — wide content (tables)
//      must scroll INSIDE its panel, so a narrow phone viewport still gets a
//      stable page frame. A body-level horizontal scrollbar is the defect
//      this spec exists to catch.
//
// The heading assertion tolerates the terminal registry states (a page whose
// registry entry answers not-applicable still mounts its heading and frame).
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

const VIEWPORTS = [
	{name: 'desktop', width: 1920, height: 1080},
	{name: 'laptop', width: 1280, height: 800},
	{name: 'tablet', width: 768, height: 1024},
	{name: 'phone', width: 375, height: 812},
] as const;

const PAGES = [
	{route: 'observability/ai', heading: 'AI Traffic'},
	{route: 'observability/workers', heading: 'Workers'},
	{route: 'observability/pdkv', heading: 'P/D & KV Cache'},
	{route: 'observability/security', heading: 'Security'},
	{route: 'observability/qos', heading: 'QoS'},
	{route: 'observability/persistence', heading: 'Persistence'},
] as const;

for (const vp of VIEWPORTS) {
	test.describe(`viewport ${vp.name} (${vp.width}×${vp.height})`, () => {
		test.use({viewport: {width: vp.width, height: vp.height}});

		for (const p of PAGES) {
			test(`${p.route} renders without body horizontal scroll`, async ({page, consoleGuard}) => {
				// Ambient testbed noise: dead registered instances 502 their probes.
				consoleGuard.allow(/Failed to load resource.*502/);
				const inst = await activeInstance();
				await page.goto(`instance/${p.route}?name=${encodeURIComponent(inst.name)}`);

				await expect(page.getByRole('heading', {name: p.heading, exact: true})).toBeVisible({timeout: 20_000});
				// Let the first metrics/REST answers land so tables have real rows
				// (an empty page trivially fits any viewport).
				await page.waitForLoadState('networkidle').catch(() => undefined);

				const overflow = await page.evaluate(() => ({
					scrollWidth: document.documentElement.scrollWidth,
					clientWidth: document.documentElement.clientWidth,
				}));
				expect(
					overflow.scrollWidth,
					`body scrolls horizontally (${overflow.scrollWidth}px content in ${overflow.clientWidth}px viewport)`,
				).toBeLessThanOrEqual(overflow.clientWidth);
			});
		}
	});
}
