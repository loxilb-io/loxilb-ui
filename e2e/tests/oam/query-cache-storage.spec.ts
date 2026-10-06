//---------------------------------------------------------
// What the persisted query cache may hold of an LB rule.
//
// The rule list is kept in the query cache, and the cache is written to
// localStorage so a reload does not start empty. A gateway may return a rule's
// backend client private key inline on every read, so the key has to be gone
// before the list is cached — and a cache written by a build that did not drop
// it has to be discarded on load, not read back once and then replaced.
//
// What each case would catch:
// - the key, or its field, reaching browser storage with the rest of the rule;
// - the fix overreaching and dropping the backend TLS settings beside it;
// - an old cache being restored because the stored format marker still matches.
//
// Both cases stub one read (the rule list) around the gateway's own answer.
// The key is a plain stand-in sentence: nothing here is, or looks like, key
// material.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {rowByText, showAllRows, toolbarButton} from '../../helpers/table';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
/** Default key of the query persister. */
const CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE';
/** The format marker of the last build that cached the rule list as read. */
const OLD_BUSTER = 'v2-live-telemetry-excluded';
const STAND_IN = 'stand in text where a gateway would put a key';
const CA_ID = 'e2e-store-ca';

function ruleWithBackendKey(name: string, octet: number) {
	return {
		serviceArguments: {
			name,
			externalIP: `203.0.113.${octet}`,
			port: 8600 + (octet % 100),
			protocol: 'tcp',
			mode: 4,
			sel: 0,
			mtls_backend: {backend_ca_cert_id: CA_ID, client_key_data: STAND_IN},
		},
		endpoints: [{endpointIP: `198.51.100.${octet}`, targetPort: 9000, weight: 1}],
	};
}

async function storedCache(page: Page): Promise<string> {
	return page.evaluate(key => window.localStorage.getItem(key) ?? '', CACHE_KEY);
}

/** Every value in both web storages, joined: the key must be in none of them. */
async function allStorage(page: Page): Promise<string> {
	return page.evaluate(() => {
		const out: string[] = [];
		for (const store of [window.localStorage, window.sessionStorage]) {
			for (let i = 0; i < store.length; i++) out.push(store.getItem(store.key(i) ?? '') ?? '');
		}
		return out.join('\n');
	});
}

test.describe('Persisted query cache and the LB rule list', () => {
	let instance: {id: number; name: string};

	test.beforeAll(async () => {
		instance = await activeInstance();
	});

	test('@gw ST-key: a backend client key in the rule read never reaches browser storage', async ({page}) => {
		const name = 'e2e-lb-store-key';
		await page.route(LB_ALL_RE, async (route: Route) => {
			const response = await route.fetch();
			const body = await response.json();
			body.lbAttr = [...(body.lbAttr ?? []), ruleWithBackendKey(name, 211)];
			await route.fulfill({response, json: body});
		});

		await page.goto(`instance/traffic/lb?name=${instance.name}`);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
		await expect(rowByText(page, name), 'the stubbed rule reached the list').toHaveCount(1);

		// The cache is written a moment after the read; wait for this rule to be
		// in it, so the absence below is about the key and not about timing.
		await expect.poll(() => storedCache(page), {message: 'the rule list is persisted', timeout: 20_000}).toContain(name);

		const cache = await storedCache(page);
		expect(cache, 'the rest of the backend TLS settings is cached as read').toContain(CA_ID);
		expect(cache, 'the key value is not cached').not.toContain(STAND_IN);
		expect(cache, 'the key field is not cached').not.toContain('client_key_data');
		expect(await allStorage(page), 'the key is in no web storage').not.toContain(STAND_IN);
	});

	test('@gw ST-old-cache: a cache written before the key was dropped is discarded on load', async ({page}) => {
		const stale = 'e2e-lb-store-stale';
		// Seeded before any app script runs, as an earlier build would have left
		// it: the rule list as read, key included, fresh enough to be used, under
		// the key the page reads the list from.
		await page.addInitScript(
			({key, buster, queryKey, rule}) => {
				const now = Date.now();
				window.localStorage.setItem(key, JSON.stringify({
					buster,
					timestamp: now,
					clientState: {
						mutations: [],
						queries: [{
							queryKey,
							queryHash: JSON.stringify(queryKey),
							state: {
								data: [rule], dataUpdateCount: 1, dataUpdatedAt: now, error: null, errorUpdateCount: 0, errorUpdatedAt: 0,
								fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: false, status: 'success', fetchStatus: 'idle',
							},
						}],
					},
				}));
			},
			{key: CACHE_KEY, buster: OLD_BUSTER, queryKey: ['lb_data', String(instance.id)], rule: ruleWithBackendKey(stale, 212)},
		);

		// The list read is held, so anything the page shows meanwhile can only
		// have come out of storage.
		let release: () => void = () => {};
		const held = new Promise<void>(resolve => { release = resolve; });
		let asked = 0;
		await page.route(LB_ALL_RE, async (route: Route) => {
			asked++;
			await held;
			await route.continue();
		});

		await page.goto(`instance/traffic/lb?name=${instance.name}`);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		// With nothing restored the page has no list and must ask for one.
		await expect.poll(() => asked, {message: 'the page asked the gateway for the list', timeout: 20_000}).toBeGreaterThan(0);
		await expect(rowByText(page, stale), 'the old cache was not shown').toHaveCount(0);
		await expect.poll(() => allStorage(page), {message: 'the old cache is gone from storage', timeout: 10_000}).not.toContain(STAND_IN);

		release();
		// Persistence itself still works: the list is cached again, under a
		// marker that is not the old one.
		await expect.poll(() => storedCache(page), {message: 'the fresh list is persisted', timeout: 20_000}).toContain('"lb_data"');
		const cache = JSON.parse(await storedCache(page));
		expect(cache.buster, 'the cache is written under a new format marker').not.toBe(OLD_BUSTER);
		expect(JSON.stringify(cache)).not.toContain(stale);
	});
});
