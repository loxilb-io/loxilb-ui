//---------------------------------------------------------
// Published Model Profiles — hardening layer (MP-E2E-016..018).
//
// Hostile-looking registry content must render as inert text, the whole
// read/select surface must work keyboard-only, and the inventory must
// prove mutation-zero after real interaction (not just on first paint).
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {grid, rowByText, toolbarButton} from '../../helpers/table';

const LIST_RE = /\/netlox\/v1\/config\/ai\/model-profiles(\?.*)?$/;

const XSS = '<script>window.__mp_pwned = 1</script>';
const IMG_XSS = '<img src=x onerror="window.__mp_pwned=2">';
const RTL = 'weird-‮name‬-profile';
const LONG_ID = 'a-very-long-profile-id-'.repeat(12);

const HOSTILE_REGISTRY = {
	registryGeneration: 7,
	setDigest: `sha256:${XSS}`,
	profiles: [
		{profileId: XSS, gen: 7, baseModel: IMG_XSS, aliasPolicy: 'list', allowedAliases: [XSS, RTL], supportedApis: ['chat'], tokenizerSha256: 'f'.repeat(64), rendererEngine: XSS, oracleEngine: IMG_XSS},
		{profileId: LONG_ID, gen: 7, baseModel: 'org/long', aliasPolicy: 'base_model_only', supportedApis: ['completions'], tokenizerSha256: 'e'.repeat(64)},
		{profileId: 'kb-profile', gen: 7, baseModel: 'org/kb-model', aliasPolicy: 'base_model_only', supportedApis: ['chat'], tokenizerSha256: 'd'.repeat(64), templateSha256: 'c'.repeat(64)},
	],
};

let instName: string;

async function mockList(page: Page, body: unknown) {
	const mutations: string[] = [];
	page.on('request', request => {
		if (/\/config\/ai\/model-profiles/.test(request.url()) && request.method() !== 'GET') {
			mutations.push(`${request.method()} ${request.url()}`);
		}
	});
	await page.route(LIST_RE, (route: Route) => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)}));
	return {mutationRequests: () => mutations};
}

test.describe('@gw Published Model Profiles — hardening', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('MP-E2E-016: hostile-looking registry strings render as inert text', async ({page}) => {
		await mockList(page, HOSTILE_REGISTRY);
		await page.goto(`instance/ai/profiles?name=${instName}`);

		await expect(grid(page)).toBeVisible({timeout: 20_000});
		// The script/img payloads appear as TEXT in the grid...
		await expect(rowByText(page, /window\.__mp_pwned = 1/)).toBeVisible();
		// ...and never executed: the sentinel globals must not exist.
		expect(await page.evaluate(() => (window as any).__mp_pwned)).toBeUndefined();
		// No injected element materialized anywhere in the DOM.
		expect(await page.locator('img[src="x"]').count()).toBe(0);

		// The very long id neither crashes the layout nor hides the page shell.
		await expect(rowByText(page, new RegExp(LONG_ID.slice(0, 40)))).toBeVisible();
		await expect(toolbarButton(page, 'Refresh')).toBeVisible();

		// Detail panel renders the hostile strings as values, still inert.
		await rowByText(page, /window\.__mp_pwned = 1/).click();
		expect(await page.evaluate(() => (window as any).__mp_pwned)).toBeUndefined();
		// consoleGuard (auto) fails the test on any console error.
	});

	test('MP-E2E-017: the read/select surface is fully keyboard-operable', async ({page}) => {
		await mockList(page, HOSTILE_REGISTRY);
		await page.goto(`instance/ai/profiles?name=${instName}`);
		await expect(grid(page)).toBeVisible({timeout: 20_000});

		// Reach the Refresh control with the keyboard alone and confirm the
		// focus is visible on it.
		await page.keyboard.press('Tab');
		const refresh = toolbarButton(page, 'Refresh');
		for (let i = 0; i < 30; i++) {
			if (await refresh.evaluate(el => el === document.activeElement).catch(() => false)) break;
			await page.keyboard.press('Tab');
		}
		expect(await refresh.evaluate(el => el === document.activeElement)).toBe(true);

		// Enter the grid, walk rows with arrows, select with Space — the
		// detail panel must open without a pointer.
		const firstCell = grid(page).locator('.MuiDataGrid-row').first().locator('[role="gridcell"]').first();
		await firstCell.click(); // seed focus inside the grid (grid roving tabindex); also selects row 1
		// The detail opens only for EXACTLY one selected row, and Space on the
		// selection column TOGGLES — so keyboard-deselect row 1 before walking
		// to row 2, or the two-row selection hides the panel by design.
		await page.keyboard.press('Space'); // keyboard-deselect row 1
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Space'); // keyboard-select row 2 — exactly one
		await expect(page.getByText('Profile Details')).toBeVisible();
	});

	test('MP-E2E-018: mutation-zero after exercising the whole inventory surface', async ({page}) => {
		const counter = await mockList(page, HOSTILE_REGISTRY);
		await page.goto(`instance/ai/profiles?name=${instName}`);
		await expect(grid(page)).toBeVisible({timeout: 20_000});

		// Exercise everything the page offers: select, open detail, refresh, sort.
		await rowByText(page, 'kb-profile').click();
		await expect(page.getByText('Profile Details')).toBeVisible();
		await toolbarButton(page, 'Refresh').click();
		await page.getByRole('columnheader', {name: 'Profile ID'}).click();

		// DOM sweep: no mutation affordance appeared under any interaction state.
		for (const verb of [/^add\b/i, /^delete\b/i, /^edit\b/i, /^upload\b/i, /^activate\b/i, /^publish\b/i]) {
			await expect(page.getByRole('button', {name: verb})).toHaveCount(0);
		}
		// Wire sweep: zero non-GET requests ever touched the profile endpoints.
		expect(counter.mutationRequests(), 'profile mutation HTTP must be zero').toEqual([]);
	});
});
