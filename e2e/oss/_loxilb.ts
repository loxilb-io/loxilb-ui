//---------------------------------------------------------
// Shared scaffolding for the loxilb-oss (plain upstream loxilb)
// specs. Not a spec file — the `_` prefix keeps it out of
// playwright.config.ts's testMatch.
//
// Every spec in this directory carries the '@loxilb' tag and therefore
// runs ONLY on the loxilb leg (`npm run e2e:oss`); the default gateway
// leg greps them away. That makes the flavor guard below the most
// important thing here: a loxilb spec that silently lands on a gateway
// asserts nothing meaningful AND mutates the wrong backend.
//---------------------------------------------------------
import {expect, Page} from '@playwright/test';
import {activeInstance, gw, gwJson} from '../helpers/api';

// Every spec in this tree imports this module, so declaring the flavor here
// (rather than only in the `e2e-oss` npm script) is what makes the suite
// self-pinning: a bare `playwright test --project=oss`, an IDE run, or a
// single-file debug run all resolve E2E_INSTANCE_LOXILB the same way. Without
// it those launches silently fall back to the gateway registration — caught
// once already by requireLoxilbInstance below, which is exactly the failure
// that should never be allowed to reach a mutating spec.
process.env.E2E_FLAVOR = process.env.E2E_FLAVOR || 'loxilb';

/** The product id the gateway self-reports on /version (src/api/capabilities.ts). */
export const GATEWAY_PRODUCT = 'loxilb-inference-gateway';

/**
 * Fails fast unless the pinned instance really is plain upstream loxilb.
 *
 * Two independent signals, because each one alone has a blind spot:
 *  - /version.product: absent upstream, present on any gateway new enough to
 *    self-identify — but a gateway predating that field looks like loxilb.
 *  - a gateway-only path (404 upstream, 200/4xx-not-404 on a gateway): catches
 *    exactly the old gateways the first check misses.
 *
 * Returns the OAM registration name for `?name=` navigation.
 */
export async function requireLoxilbInstance(): Promise<string> {
	const inst = await activeInstance();
	const version = await gwJson<{product?: string; version?: string}>('/version');
	expect(version.product, `instance "${inst.name}" reports a gateway product id — pin the loxilb registration with E2E_INSTANCE_LOXILB`).not.toBe(GATEWAY_PRODUCT);
	const probe = await gw('GET', '/config/trace/status');
	expect(probe.status, `instance "${inst.name}" answers a gateway-only path — it is not plain loxilb`).toBe(404);
	return inst.name;
}

/**
 * The flavor chip in the breadcrumb doubles as the "flavor resolved" signal:
 * gating is permissive while the /version probe is in flight, so any
 * absence assertion (and any request-side contract check) is only meaningful
 * once the chip has appeared.
 */
export async function waitForLoxilbChip(page: Page): Promise<void> {
	await expect(page.locator('#navigation .MuiChip-label', {hasText: 'loxilb'})).toBeVisible({timeout: 20_000});
}

/**
 * Navigate to an instance page and wait for the flavor to resolve.
 *
 * domcontentloaded on purpose: the dashboard polls on a 1s timer, which can
 * keep the load event from ever settling over the WAN link to the testbed.
 * The chip wait is the real gate.
 */
export async function gotoLoxilbPage(page: Page, route: string, instName: string): Promise<void> {
	await page.goto(`instance/${route}?name=${instName}`, {waitUntil: 'domcontentloaded'});
	await waitForLoxilbChip(page);
}

/** Shared (non-gateway-only) instance pages, as `instance/<route>`. */
export const SHARED_PAGES = [
	'dashboard',
	'traffic/lb',
	'traffic/endpoint',
	'traffic/ct',
	'traffic/fw',
	'traffic/qos',
	'traffic/mirror',
	'network/port',
	'network/ip',
	'network/neighbor',
	'network/route',
	'network/bfd',
	'status/device',
	'status/fs',
	'status/ha',
	'status/process',
	'status/logs',
	'settings',
] as const;
