//---------------------------------------------------------
// Route titles and keyboard-operable language selection
// in a browser.
//
// Two defects, one screen:
//
//   Every route shared the static "LoxiLB Dashboard" baked into
//   public/index.html. Browser history, pinned tabs, window switchers and
//   screen-reader page announcements could not tell any two pages apart. The
//   fix mounts RouteTitle inside the router; only a real navigation can prove
//   it re-runs, which is why this lives here and not only in the unit test.
//
// the language trigger was a <Box> (a div): not focusable, no role,
//   no Enter/Space activation. A keyboard-only operator could not change the
// language AT ALL, which fails on its own before any translation
//   quality is considered. Every interaction below is keyboard-only on
//   purpose — one mouse click anywhere in this file would hide the defect.
//
// Read-only: no instance data is written, only the operator's own language
// preference (which is restored at the end of the case that changes it).
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

let instName = '';

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

//---------------------------------------------------------
// 1. Per-route document titles
//---------------------------------------------------------

test('every route carries its own title — history and tabs can tell pages apart', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);

	// A representative spread: an OAM route, a dashboard, a deep instance
	// sub-route, and an admin route. Titles come from MENU_LIST, so a page
	// renamed in the navigation cannot drift from its title.
	const routes: Array<[string, RegExp]> = [
		['instance', /^Instance — LoxiLB$/],
		[`instance/dashboard?name=${instName}`, /^Dashboard — LoxiLB$/],
		[`instance/traffic/lb?name=${instName}`, /^LB Rule — LoxiLB$/],
		['user', /^User Management — LoxiLB$/],
	];

	const seen = new Set<string>();
	for (const [path, expected] of routes) {
		await page.goto(path, {waitUntil: 'domcontentloaded'});
		await expect(page, path).toHaveTitle(expected, {timeout: 20_000});
		seen.add(await page.title());
	}

	// The property that actually failed before: not "each title is right" but
	// "the titles are DIFFERENT". A regression that pinned one static string
	// would satisfy a per-route assertion written carelessly.
	expect(seen.size, `titles must be distinct, got: ${[...seen].join(' | ')}`).toBe(routes.length);
});

//---------------------------------------------------------
// 2. Language selection, from the keyboard only
//---------------------------------------------------------

test('the language selector is announced as a menu button and carries a name', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);
	await page.goto('instance', {waitUntil: 'domcontentloaded'});

	const trigger = page.getByRole('button', {name: 'Select a language'});
	await expect(trigger, 'the trigger must be a button with an accessible name, not a div').toBeVisible({timeout: 20_000});
	await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
	await expect(trigger, 'collapsed state must be exposed, not implied by styling').toHaveAttribute('aria-expanded', 'false');
});

test('a keyboard-only operator can open the menu, choose Korean, and see it applied', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);
	await page.goto('instance', {waitUntil: 'domcontentloaded'});

	const trigger = page.getByRole('button', {name: 'Select a language'});
	await expect(trigger).toBeVisible({timeout: 20_000});

	// Focus without a pointer, then activate with Enter. The old <Box> could
	// not receive focus at all, so this line was the whole defect.
	await trigger.focus();
	await expect(trigger).toBeFocused();
	await page.keyboard.press('Enter');

	const menu = page.getByRole('menu');
	await expect(menu, 'Enter on the trigger must open the menu').toBeVisible();
	// While the menu is open MUI aria-hides the rest of the app, so the trigger
	// is no longer reachable by role — assert the expanded state on the node.
	await expect(page.locator('#language')).toHaveAttribute('aria-expanded', 'true');

	// Arrow-key traversal is MUI's default and was disabled by
	// disableAutoFocusItem/disableEnforceFocus on the old menu; the items must
	// also stay DIRECT children of the Menu or MenuList cannot walk them.
	const korean = menu.getByRole('menuitem', {name: '한국어'});
	await expect(korean).toBeVisible();
	await korean.press('Enter');

	// The selection reloads the app (navigate(0)), so wait for the applied
	// state rather than for the click to return.
	await expect(page.locator('html'), 'the document language must follow the selection').toHaveAttribute('lang', 'ko', {timeout: 30_000});
	await expect(page, 'the route title must be localized too, not just the body').toHaveTitle(/인스턴스/, {timeout: 20_000});

	// It survives a reload — a language that resets on refresh is not a
	// preference (the persistence suite pins the general case; this is the language half).
	await page.reload({waitUntil: 'domcontentloaded'});
	await expect(page.locator('html')).toHaveAttribute('lang', 'ko', {timeout: 20_000});
	await expect(page).toHaveTitle(/인스턴스/, {timeout: 20_000});

	// Restore, again from the keyboard, so the case is idempotent and leaves
	// the next reader an English UI.
	const koTrigger = page.getByRole('button', {name: /언어 선택|Select a language/});
	await koTrigger.focus();
	await page.keyboard.press('Enter');
	await page.getByRole('menu').getByRole('menuitem', {name: 'English'}).press('Enter');
	await expect(page.locator('html')).toHaveAttribute('lang', 'en', {timeout: 30_000});
});

test('Escape closes the language menu without changing anything', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);
	await page.goto('instance', {waitUntil: 'domcontentloaded'});

	const trigger = page.getByRole('button', {name: 'Select a language'});
	await expect(trigger).toBeVisible({timeout: 20_000});
	await trigger.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menu')).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toHaveCount(0);
	await expect(page.locator('#language')).toHaveAttribute('aria-expanded', 'false');
	// Focus returns to the trigger — otherwise a keyboard operator who backs
	// out of the menu is stranded at the top of the document.
	await expect(trigger, 'closing the menu must return focus to what opened it').toBeFocused();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
