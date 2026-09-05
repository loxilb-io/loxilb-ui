//---------------------------------------------------------
// KV Exact Enforcement Status panel — mock contract layer
// (MP-E2E-011..015).
//
// The LB list and the kvexactstatus endpoint are intercepted, so every
// ladder state, error status, and the pending→READY→DEGRADED lifecycle are
// deterministic. Ready must come from the STATUS, never from a write
// response; polling continues after READY (drift detection) and stops when
// the panel unmounts.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {rowByText} from '../../helpers/table';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const STATUS_RE = /\/kvexactstatus(\?.*)?$/;

const RULE_NAME = 'e2e-mp-status';

function strictRule(over: Record<string, unknown> = {}) {
	return {
		serviceArguments: {
			name: RULE_NAME,
			externalIP: '192.0.2.90',
			port: 18090,
			protocol: 'tcp',
			sel: 0,
			mode: 4,
			inactiveTimeOut: 30,
			model_name: 'Qwen/Qwen3-32B',
			pd_disagg_mode: true,
			kvExactMode: 1,
			kvBlockSize: 16,
			kvModelProfile: 'qwen3-chat',
			kvExactApiMode: 'chat',
			...over,
		},
		secondaryIPs: [],
		allowedSources: [],
		endpoints: [
			{endpointIP: '198.51.100.91', weight: 1, targetPort: 8000, state: 'active', counter: '0', ep_role: 1},
			{endpointIP: '198.51.100.92', weight: 1, targetPort: 8000, state: 'active', counter: '0', ep_role: 2},
		],
	};
}

function statusEntry(over: Record<string, unknown> = {}) {
	return {
		ruleIdentity: 'rule-mp-1',
		modelName: 'Qwen/Qwen3-32B',
		engineFamily: 'vllm',
		apiMode: 'chat',
		modelProfileId: 'qwen3-chat',
		modelProfileGen: 4,
		bindingGen: 2,
		bindingDigest: 'sha256:bind42',
		hashContractId: 'sha256_cbor',
		requiredEvidenceLevel: 'attested',
		desiredState: 'READY',
		enforcedState: 'PENDING_DATAPLANE_CONTRACT',
		reasonCodes: ['binding_dataplane_pending'],
		...over,
	};
}

let instName: string;

async function mockLbList(page: Page, rule: unknown) {
	await page.route(LB_ALL_RE, (route: Route) => route.fulfill({
		status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: [rule]}),
	}));
}

/** Sequence responder: response i comes from bodies[min(i, last)]; returns the call counter. */
async function mockStatusSequence(page: Page, responses: Array<{status?: number; body: unknown}>) {
	let calls = 0;
	await page.route(STATUS_RE, (route: Route) => {
		const step = responses[Math.min(calls, responses.length - 1)];
		calls += 1;
		return route.fulfill({status: step.status ?? 200, contentType: 'application/json', body: JSON.stringify(step.body)});
	});
	return {count: () => calls};
}

async function openStatusPanel(page: Page) {
	await page.goto(`instance/traffic/lb?name=${instName}`);
	await rowByText(page, RULE_NAME).click();
	await page.getByRole('tab', {name: 'AI Gateway'}).click();
	await expect(page.getByText('KV Exact Enforcement Status')).toBeVisible({timeout: 20_000});
}

test.describe('@gw KV-exact enforcement status — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('MP-E2E-011: pending→READY→DEGRADED lifecycle; polling survives READY and stops on unmount', async ({page}) => {
		test.setTimeout(120_000);
		await mockLbList(page, strictRule());
		const counter = await mockStatusSequence(page, [
			{body: {kvExactStatusAttr: [statusEntry()]}},
			{body: {kvExactStatusAttr: [statusEntry({enforcedState: 'READY', reasonCodes: [], enforcement: {desired: 'READY', enforced: 'READY', goFenced: false, lastAckAt: '2026-09-04T10:00:00Z'}})]}},
			{body: {kvExactStatusAttr: [statusEntry({enforcedState: 'DEGRADED', reasonCodes: ['attestation_stale'], enforcement: {desired: 'READY', enforced: 'DEGRADED', goFenced: true}})]}},
		]);

		await openStatusPanel(page);

		// 1. Initial pending is a normal transition — and it is NOT Ready.
		await expect(page.getByText(/Not ready — PENDING_DATAPLANE_CONTRACT/)).toBeVisible({timeout: 20_000});
		expect(page.getByText(/Ready — fully attested/)).not.toBeVisible;

		// 2. Ready appears only once the STATUS reports READY + lifted fence.
		await expect(page.getByText(/Ready — fully attested and enforced/)).toBeVisible({timeout: 30_000});
		await expect(page.getByText('Fence lifted')).toBeVisible();

		// 3. Steady-state polling still runs after READY and surfaces the later
		//    degradation (drift detection — polling never fully stops while visible).
		await expect(page.getByText(/Degraded — fenced after a confirmed degradation/)).toBeVisible({timeout: 45_000});
		await expect(page.getByText('attestation_stale')).toBeVisible();

		// 4. Unmount aborts polling: leave the tab, the request count freezes.
		await page.getByRole('tab', {name: 'Settings'}).click();
		const after = counter.count();
		await page.waitForTimeout(7_000);
		expect(counter.count(), 'polling must stop when the panel unmounts').toBe(after);
	});

	test('MP-E2E-012: degraded/fault/fenced render unsafe text, fault detail, and raw reasons', async ({page}) => {
		await mockLbList(page, strictRule());
		await mockStatusSequence(page, [{
			body: {kvExactStatusAttr: [statusEntry({enforcedState: 'ENFORCEMENT_FAULT', reasonCodes: ['enforcement_fault', 'binding_state_missing'], enforcement: {desired: 'READY', enforced: 'ENFORCEMENT_FAULT', goFenced: true, fault: 'contract word rejected'}})]},
		}]);

		await openStatusPanel(page);
		await expect(page.getByText(/Enforcement fault — fenced, not silently downgraded to legacy/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText('Fenced — exact routing denied')).toBeVisible();
		// exact:true — the case-insensitive substring form also matches the two
		// ENFORCEMENT_FAULT state fields; the reason CHIP is the lowercase text.
		await expect(page.getByText('enforcement_fault', {exact: true})).toBeVisible();
		await expect(page.getByText('binding_state_missing', {exact: true})).toBeVisible();
	});

	test('MP-E2E-013: unknown state/reason vocabulary renders raw, non-ready, without a crash', async ({page}) => {
		await mockLbList(page, strictRule());
		await mockStatusSequence(page, [{
			body: {kvExactStatusAttr: [statusEntry({enforcedState: 'QUANTUM_ATTESTED_V9', reasonCodes: ['brand_new_reason'], enforcement: {desired: 'READY', enforced: 'QUANTUM_ATTESTED_V9', goFenced: false}})]},
		}]);

		await openStatusPanel(page);
		await expect(page.getByText(/Unknown state "QUANTUM_ATTESTED_V9" — treated as not ready/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText('brand_new_reason')).toBeVisible();
		// consoleGuard (auto fixture) fails the test on any console error.
	});

	test('MP-E2E-014: a legacy rule shows Legacy / unattested with strict-only fields absent', async ({page}) => {
		await mockLbList(page, strictRule({kvModelProfile: undefined, kvExactApiMode: undefined}));
		await mockStatusSequence(page, [{
			body: {kvExactStatusAttr: [statusEntry({enforcedState: 'LEGACY_ACTIVE_UNATTESTED', desiredState: 'LEGACY_ACTIVE_UNATTESTED', modelProfileId: undefined, modelProfileGen: undefined, bindingGen: undefined, bindingDigest: undefined, requiredEvidenceLevel: undefined, reasonCodes: ['no_model_profile_bound'], enforcement: undefined})]},
		}]);

		await openStatusPanel(page);
		await expect(page.getByText(/Legacy \/ unattested — profile-less rule/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText('Binding Identity')).toHaveCount(0);
		await expect(page.getByText('Data-plane Enforcement')).toHaveCount(0);
	});

	test('MP-E2E-015: status 404/422/503 render distinct inline UX with no redirect', async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of (404|422|503)/i);
		consoleGuard.allow(/Failed to load resource/i);
		await mockLbList(page, strictRule());

		// 404 — coalesced "no KV-exact status": data, not an error, no redirect.
		await mockStatusSequence(page, [{status: 404, body: {message: 'no kv-exact rule'}}]);
		await openStatusPanel(page);
		await expect(page.getByText('No KV-exact status for this selection.')).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('button', {name: 'Retry'})).toHaveCount(0);
		expect(page.url()).toContain('instance/traffic/lb');

		// 422 — terminal, no retry affordance.
		await page.unroute(STATUS_RE);
		await mockStatusSequence(page, [{status: 422, body: {message: 'validation failed', code: 602}}]);
		await openStatusPanel(page);
		await expect(page.getByText(/rejected the status query as malformed \(422\)/)).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('button', {name: 'Retry'})).toHaveCount(0);

		// 503 — temporarily unavailable, manual retry offered.
		await page.unroute(STATUS_RE);
		await mockStatusSequence(page, [{status: 503, body: {message: 'credential store unavailable'}}]);
		await openStatusPanel(page);
		await expect(page.getByText(/temporarily unavailable/)).toBeVisible({timeout: 30_000});
		await expect(page.getByRole('button', {name: 'Retry'})).toBeVisible();
	});
});
