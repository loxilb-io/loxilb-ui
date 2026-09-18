//---------------------------------------------------------
// AI Tenant Rate Limits — Refresh must converge the WHOLE page (Stage 4.0).
//
// This pins the half-refresh defect that #106 fixed on the JWT Auth Profiles
// page and this page repeated: `handleRefresh` refetched only the rate-limit
// rows, while three other reads paint the page and each one, left stale, makes
// it assert something false that no operator control could correct.
//
//   `useApiKeys`              the tenant set is DERIVED from the tenants seen
//                             on API keys (the gateway has no list-all for
//                             tenant rate limits), so a key created elsewhere
//                             never joins the list and its tenant's limit
//                             stays invisible.
//   `useLoadBalancerConfig`   gates the "enforcement is not proven" warning —
//                             an operator can attach a policy that requires
//                             data-plane API keys, press Refresh, and still be
//                             told their quotas are inert.
//   the quota defaults read   carries the quota STORE STATE, which is the
//                             token-quota panel's entire finding (Stage 3.6).
//                             Stale, it keeps telling an operator who has just
//                             configured a store that nothing is enforced.
//
// ⚠️ MOCKED, not live, and that is a requirement rather than a convenience.
// The live suite's upsert paths gate on `gatewayAIManagementReadiness()` and
// skip on a gateway whose API-key store is unconfigured — which is every
// gateway on this testbed (`GET /config/ai/apikey` answers 503
// `ai_key_store_unconfigured`). A live pin would therefore skip and assert
// nothing. Mocking the four reads lets the seeding happen OUT OF BAND, which
// is the only arrangement that actually tests the Refresh button.
//
// ⚠️ DELIBERATELY NO `page.reload()`. A reload refetches everything as a side
// effect of remounting, so it passes whether or not Refresh is wired
// correctly — it would hide exactly the defect this spec exists to catch.
//
// ⚠️ These reads do NOT poll (`useQueryInstanceData` sets no `refetchInterval`;
// `staleTime` 5 s makes data stale but never refetches it without a trigger),
// so nothing converges this page on its own. If it converges, Refresh did it.
//
// ▶️ MUTATION-FALSIFY when touching `handleRefresh`: delete any ONE of
// `refetchApiKeys()`, `refetchLb()` or `defaults_query.refetch()` and exactly
// one of the three assertions below must fail.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {grid, rowByText, toolbarButton} from '../../helpers/table';

const TENANT_SEEDED = 'rl-refresh-seeded';
const TENANT_OUT_OF_BAND = 'rl-refresh-out-of-band';

const APIKEY_RE = /\/netlox\/v1\/config\/ai\/apikey(\?.*)?$/;
const TENANT_RL_RE = /\/netlox\/v1\/config\/ai\/tenant\/ratelimit\/([^/?]+)(\?.*)?$/;
const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const DEFAULTS_GLOBAL_RE = /\/netlox\/v1\/config\/ai\/ratelimit\/defaults\/global(\?.*)?$/;

const json = (route: Route, status: number, body: unknown) =>
	route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

// The mutable server the page reads. Flipping a field here is the "seed from
// another console" that Refresh alone must pick up.
interface IMockState {
	tenants: string[];
	apiKeyRequired: boolean;
	quotaStoreConfigured: boolean;
}

async function mockPage(page: Page, state: IMockState) {
	// Keys carry the tenant set the page derives its rows from.
	await page.route(APIKEY_RE, (route: Route) =>
		json(route, 200, state.tenants.map((tenant_id, i) => ({key_id: `key-${i}`, tenant_id, name: `key-${i}`, enabled: true}))),
	);

	// Every known tenant has a configured limit; anything else is a normal 404.
	await page.route(TENANT_RL_RE, (route: Route) => {
		const tenant = decodeURIComponent(TENANT_RL_RE.exec(route.request().url())?.[1] ?? '');
		if (!state.tenants.includes(tenant)) return json(route, 404, {message: 'not found'});
		return json(route, 200, {tenant_id: tenant, rps: 10, tokens_per_min: 1000, burst_pct: 0, model_limits: []});
	});

	// Gates the enforcement warning.
	await page.route(LB_ALL_RE, (route: Route) =>
		json(route, 200, {lbAttr: state.apiKeyRequired ? [{serviceArguments: {api_key_auth: 'required'}}] : []}),
	);

	// ⚠️ 503 `ai_key_store_unconfigured` is the REAL answer on this testbed, so
	// the starting state is the honest one. The flip to a configured store with
	// a positive tenant default is what must become visible on Refresh.
	await page.route(DEFAULTS_GLOBAL_RE, (route: Route) => {
		if (!state.quotaStoreConfigured) {
			return json(route, 503, {code: 503, fields: [], message: 'ai_key_store_unconfigured', result: 'ai_key_store_unconfigured'});
		}
		return json(route, 200, {default_tenant_tpm: 5000, default_user_tpm: 0, vip_shared_tpm: 0});
	});
}

test.describe('@gw AI Tenant Rate Limits — Refresh convergence', () => {
	let instName: string;

	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('RL-E2E-R1: Refresh alone converges the tenant list, the enforcement warning and the quota store state', async ({page, consoleGuard}) => {
		// The unconfigured-store arm of this test IS a 503, deliberately — it is
		// the answer every gateway on this testbed really gives. The same two
		// allowances the live spec carries.
		consoleGuard.allow(/status of (401|403|503)/i);
		consoleGuard.allow(/Failed to load resource/i);

		const state: IMockState = {tenants: [TENANT_SEEDED], apiKeyRequired: false, quotaStoreConfigured: false};
		await mockPage(page, state);

		await page.goto(`instance/ai/ratelimit?name=${instName}`);
		await expect(grid(page)).toBeVisible({timeout: 20_000});

		// The page as first painted: one tenant, no required policy, no store.
		await expect(rowByText(page, TENANT_SEEDED).first()).toBeVisible();
		await expect(rowByText(page, TENANT_OUT_OF_BAND)).toHaveCount(0);
		await expect(page.getByText(/no loaded service explicitly requires data-plane API keys/i)).toBeVisible();
		await expect(page.getByText('No quota store is configured')).toBeVisible();

		// ── Seed out of band. Another console creates a key for a second
		// tenant, attaches a policy that requires API keys, and configures the
		// quota store. The page is NOT told and is NOT reloaded.
		state.tenants = [TENANT_SEEDED, TENANT_OUT_OF_BAND];
		state.apiKeyRequired = true;
		state.quotaStoreConfigured = true;

		// Nothing has converged yet: no poll, no focus change, no remount.
		await expect(rowByText(page, TENANT_OUT_OF_BAND)).toHaveCount(0);

		// ── One Refresh click is the only operator action.
		await toolbarButton(page, 'Refresh').click();

		// 1. `refetchApiKeys()` — the out-of-band tenant joins the list. The
		//    tenant set is part of the rate-limit query KEY, so picking up the
		//    key also re-reads the limits for the new set.
		await expect(rowByText(page, TENANT_OUT_OF_BAND).first()).toBeVisible({timeout: 10_000});

		// 2. `refetchLb()` — the enforcement warning is gone, because a service
		//    now requires data-plane API keys.
		await expect(page.getByText(/no loaded service explicitly requires data-plane API keys/i)).toHaveCount(0);

		// 3. `defaults_query.refetch()` — the quota panel stops reporting a
		//    missing store. With a positive tenant default and no live bucket
		//    the honest verdict is "configured, nothing metered yet".
		await expect(page.getByText('No quota store is configured')).toHaveCount(0);
		await expect(page.getByText('Limits configured, nothing metered yet')).toBeVisible({timeout: 10_000});

		// The seeded tenant never disappeared in the process.
		await expect(rowByText(page, TENANT_SEEDED).first()).toBeVisible();
	});
});
