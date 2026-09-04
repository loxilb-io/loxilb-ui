//---------------------------------------------------------
// Published Model Profiles — mock contract layer (MP-E2E-001..004).
//
// Playwright route interception pins every registry shape and error state
// deterministically at the OAM→gateway proxy boundary; the login/session and
// instance resolution stay real. The loxilb-flavor case (MP-E2E-005) lives
// in e2e/oss/tests/gating.spec.ts + contract-guard, where a real plain
// loxilb answers.
//
// The inventory is READ-ONLY by requirement (AC-12): these specs also count
// every non-GET request that touches the profile endpoints — the number is
// zero, always.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {grid, rowByText, toolbarButton} from '../../helpers/table';

const LIST_RE = /\/netlox\/v1\/config\/ai\/model-profiles(\?.*)?$/;

const PROFILES = [
	{
		profileId: 'llama-both',
		gen: 4,
		baseModel: 'meta-llama/Llama-3-70B',
		aliasPolicy: 'base_model_only',
		supportedApis: ['completions', 'chat'],
		tokenizerSha256: 'c0ffee'.repeat(10) + 'c0ff',
		templateSha256: 'd00d'.repeat(16),
		templateContentFormat: 'string',
		rendererEngine: 'minijinja',
		rendererVersion: '2.0.1',
		oracleEngine: 'transformers',
		oracleVersion: '4.51.0',
	},
	{
		profileId: 'qwen3-chat',
		gen: 4,
		baseModel: 'Qwen/Qwen3-32B',
		aliasPolicy: 'list',
		allowedAliases: ['qwen-chat'],
		supportedApis: ['chat'],
		tokenizerSha256: 'ab'.repeat(32),
		tokenizerRevision: 'f8a2b1',
	},
];

const REGISTRY = {registryGeneration: 4, setDigest: 'sha256:2f7c1e99aa04', profiles: PROFILES};
const REGISTRY_GEN0 = {registryGeneration: 0, profiles: []};
// MP-E2E-004: only contract-required fields — every optional key absent.
const REGISTRY_MINIMAL = {
	registryGeneration: 2,
	setDigest: 'sha256:0011deadbeef',
	profiles: [{profileId: 'bare-min', gen: 2, baseModel: 'org/bare-model', aliasPolicy: 'base_model_only', supportedApis: ['completions'], tokenizerSha256: 'ee'.repeat(32)}],
};

const LEGACY_EMPTY_COPY = 'No profiles are currently published. Legacy profile-less routing remains available.';

let instName: string;

/** Intercept the list read with a fixed body/status; count mutation attempts. */
async function mockList(page: Page, body: unknown, status = 200, headers: Record<string, string> = {}) {
	const mutations: string[] = [];
	page.on('request', request => {
		if (/\/config\/ai\/model-profiles/.test(request.url()) && request.method() !== 'GET') {
			mutations.push(`${request.method()} ${request.url()}`);
		}
	});
	await page.route(LIST_RE, (route: Route) => route.fulfill({
		status,
		contentType: 'application/json',
		headers,
		body: JSON.stringify(body),
	}));
	return {mutationRequests: () => mutations};
}

test.describe('@gw Published Model Profiles — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('MP-E2E-001: populated inventory — rows, registry header, sort, zero mutation surface', async ({page}) => {
		const counter = await mockList(page, REGISTRY);
		await page.goto(`instance/ai/profiles?name=${instName}`);

		// Rows and columns (deterministic order: profiles arrive sorted by profileId).
		await expect(grid(page)).toBeVisible({timeout: 20_000});
		await expect(rowByText(page, 'llama-both')).toBeVisible();
		await expect(rowByText(page, 'qwen3-chat')).toBeVisible();
		await expect(page.getByText('Qwen/Qwen3-32B')).toBeVisible();

		// Registry header: generation + full set digest + Refresh only.
		await expect(page.getByText('Generation 4')).toBeVisible();
		await expect(page.getByText('sha256:2f7c1e99aa04')).toBeVisible();
		await expect(toolbarButton(page, 'Refresh')).toBeVisible();

		// The grid sorts client-side.
		await page.getByRole('columnheader', {name: 'Profile ID'}).click();
		await expect(page.getByRole('columnheader', {name: 'Profile ID'})).toHaveAttribute('aria-sort', /ascending|descending/);

		// Detail panel is read-only display (SingleTextField values live in inputs).
		await rowByText(page, 'qwen3-chat').click();
		await expect(page.getByRole('textbox', {name: 'Tokenizer SHA-256'})).toHaveValue('ab'.repeat(32)); // full digest, not the short form
		await expect(page.getByRole('textbox', {name: 'Alias Policy'})).toHaveValue('Base model + allowed aliases');
		await expect(page.getByRole('textbox', {name: 'Allowed Aliases'})).toHaveValue('qwen-chat');

		// AC-12: no mutation affordance, no mutation HTTP.
		for (const verb of ['Add', 'Delete', 'Edit', 'Upload', 'Activate']) {
			await expect(toolbarButton(page, verb), `${verb} must not exist on the read-only inventory`).toHaveCount(0);
		}
		expect(counter.mutationRequests(), 'mutation HTTP against the profile registry').toEqual([]);
	});

	test('MP-E2E-002: gen0 empty registry is a normal legacy state, not an error', async ({page}) => {
		await mockList(page, REGISTRY_GEN0);
		await page.goto(`instance/ai/profiles?name=${instName}`);

		await expect(page.getByText(LEGACY_EMPTY_COPY)).toBeVisible({timeout: 20_000});
		await expect(page.getByText('Generation 0')).toBeVisible();
		// A healthy empty registry paints no failure surface.
		await expect(page.locator('.MuiAlert-standardError')).toHaveCount(0);
		await expect(page.getByText(/temporarily unavailable|don't have permission|Couldn't load/)).toHaveCount(0);
		// The consoleGuard fixture asserts no error-page redirect on teardown.
	});

	test('MP-E2E-003: 401/403/500/503 render as four distinct inline states', async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of (401|403|500|503)/i);
		consoleGuard.allow(/Failed to load resource/i);

		// 403 → denied (permission vocabulary).
		await mockList(page, {message: 'forbidden'}, 403);
		await page.goto(`instance/ai/profiles?name=${instName}`);
		await expect(page.getByText(/don't have permission to view/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText(LEGACY_EMPTY_COPY)).toHaveCount(0);

		// 503 → temporarily unavailable, with a retry affordance.
		await page.unroute(LIST_RE);
		await mockList(page, {message: 'store unavailable'}, 503);
		await page.goto(`instance/ai/profiles?name=${instName}`);
		await expect(page.getByText(/temporarily unavailable/)).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('button', {name: 'Retry'})).toBeVisible();

		// 500 → hard failure vocabulary, distinct from both above.
		await page.unroute(LIST_RE);
		await mockList(page, {message: 'internal'}, 500);
		await page.goto(`instance/ai/profiles?name=${instName}`);
		await expect(page.getByText(/Couldn't load/)).toBeVisible({timeout: 20_000});

		// 401 with the gateway-origin marker stays INLINE as denied — the
		// management-hop credential failing must not tear down the human's
		// OAM browser session.
		await page.unroute(LIST_RE);
		await mockList(page, {message: 'unauthorized'}, 401, {'X-Loxi-Error-Origin': 'gateway'});
		await page.goto(`instance/ai/profiles?name=${instName}`);
		await expect(page.getByText(/don't have permission to view/)).toBeVisible({timeout: 20_000});
		expect(page.url(), 'gateway-origin 401 must not log the session out').toContain('instance/ai/profiles');
	});

	test('MP-E2E-004: absent optional fields render clean — no null/undefined artifacts', async ({page}) => {
		await mockList(page, REGISTRY_MINIMAL);
		await page.goto(`instance/ai/profiles?name=${instName}`);

		await expect(rowByText(page, 'bare-min')).toBeVisible({timeout: 20_000});
		await rowByText(page, 'bare-min').click();

		// Required identity renders; absent optionals show honest placeholders.
		await expect(page.getByRole('textbox', {name: 'Base Model'})).toHaveValue('org/bare-model');
		await expect(page.getByRole('textbox', {name: 'Chat Template SHA-256'})).toHaveValue('No chat template bound');
		await expect(page.getByRole('textbox', {name: 'Tokenizer Revision'})).toHaveValue('Not recorded');

		// No serialization artifacts anywhere on the page — text nodes or inputs.
		await expect(page.getByText(/\bundefined\b/)).toHaveCount(0);
		await expect(page.getByText(/^null$/)).toHaveCount(0);
		await expect(page.locator('input[value="undefined"], input[value="null"]')).toHaveCount(0);
	});
});
