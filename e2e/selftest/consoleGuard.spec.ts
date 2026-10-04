//---------------------------------------------------------
// Self-tests for the console guard (e2e/helpers/consoleGuard.ts)
//---------------------------------------------------------
// The guard is what turns an uncaught error into a red spec, so a defect in it
// does not show up as a failure — it shows up as specs that pass while hiding
// the error they exist to catch. These pin its two safety properties:
//
//   - a request allowance allows THAT request, not every failed request;
//   - adding the URL did not widen any existing text allowance.
//
// G-05..G-07 drive a real Chrome page on a routed origin: the whole change
// rests on Chrome reporting the failed request as the message's location, and
// only a browser can confirm that.
import {expect, test} from '@playwright/test';
import {attachConsoleGuard, isAllowed, toConsoleError} from '../helpers/consoleGuard';

const NOT_FOUND = 'Failed to load resource: the server responded with a status of 404 (Not Found)';
const CAPS = 'http://gw.test:8080/oam/loxilbs/1/netlox/v1/status/capabilities';

//---------------------------------------------------------
// G-01..G-04 — pure
//---------------------------------------------------------

test('G-01 a resource failure is recorded with its path and status, never its host', () => {
	expect(toConsoleError(NOT_FOUND, CAPS)).toEqual({
		text: NOT_FOUND,
		request: {path: '/oam/loxilbs/1/netlox/v1/status/capabilities', status: 404},
	});
});

test('G-02 a request allowance needs BOTH the status and the path', () => {
	const allow = [{status: 404, path: /\/status\/capabilities$/}];
	expect(isAllowed(toConsoleError(NOT_FOUND, CAPS), [], allow)).toBe(true);
	// Same status, other path — the regression this exists to keep visible.
	expect(isAllowed(toConsoleError(NOT_FOUND, 'http://gw.test/oam/loxilbs/1/netlox/v1/config/loadbalancer/all'), [], allow)).toBe(false);
	// Same path, other status — a capability read that starts 500-ing is a defect.
	const serverError = 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)';
	expect(isAllowed(toConsoleError(serverError, CAPS), [], allow)).toBe(false);
});

test('G-03 a text allowance still sees only the text — the URL does not widen it', () => {
	// `/403/` is a real allowance in this suite. Had the URL been appended to the
	// text it matches, a 404 on a path containing "403" would slip through.
	const err = toConsoleError(NOT_FOUND, 'http://gw.test/oam/loxilbs/1/netlox/v1/config/rule/403');
	expect(isAllowed(err, [/403/], [])).toBe(false);
});

test('G-04 a message that is not a resource failure carries no request', () => {
	expect(toConsoleError('Warning: Each child in a list should have a unique "key" prop.', CAPS)).toEqual({
		text: 'Warning: Each child in a list should have a unique "key" prop.',
	});
});

//---------------------------------------------------------
// G-05..G-07 — a real Chrome page
//---------------------------------------------------------

async function pageFetching(page: import('@playwright/test').Page, path: string, status: number): Promise<void> {
	await page.route('http://gw.test/**', route => {
		const url = new URL(route.request().url());
		if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: `<script>fetch('${path}')</script>`});
		return route.fulfill({status, contentType: 'application/json', body: '{}'});
	});
	await page.goto('http://gw.test/');
	await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').length)).toBeGreaterThan(0);
}

test('G-05 Chrome reports which request failed, and the violation names it', async ({page}) => {
	const guard = attachConsoleGuard(page);
	await pageFetching(page, '/oam/loxilbs/1/netlox/v1/config/loadbalancer/all', 404);
	await expect.poll(() => guard.violations()).toEqual([`${NOT_FOUND} — /oam/loxilbs/1/netlox/v1/config/loadbalancer/all`]);
});

test('G-06 a gateway without the capability surface is not a violation', async ({page}) => {
	// The older-gateway 404 the contract reads as `unknown` (B-03). Allowed
	// globally, by path — nothing else inherits the allowance.
	const guard = attachConsoleGuard(page);
	// Wait for the error itself, not for time: asserting an absence is only
	// meaningful once the thing that would be absent has actually arrived.
	const logged = page.waitForEvent('console', m => m.type() === 'error');
	await pageFetching(page, '/oam/loxilbs/1/netlox/v1/status/capabilities', 404);
	await logged;
	expect(guard.violations()).toEqual([]);
});

test('G-07 a capability read that fails any other way is still a violation', async ({page}) => {
	const guard = attachConsoleGuard(page);
	await pageFetching(page, '/oam/loxilbs/1/netlox/v1/status/capabilities', 500);
	await expect.poll(() => guard.violations()).toHaveLength(1);
	expect(guard.violations()[0]).toMatch(/status of 500 .* — \/oam\/loxilbs\/1\/netlox\/v1\/status\/capabilities$/);
});
