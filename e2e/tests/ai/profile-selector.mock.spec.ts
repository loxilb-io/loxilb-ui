//---------------------------------------------------------
// Strict-rule Model Profile selector — mock contract layer
// (MP-E2E-006..010).
//
// Every profile/LB endpoint the flow touches is intercepted, so the specs
// pin the UI's write-safety behavior deterministically and no rule ever
// reaches the real gateway:
//   - list/detail: fixture registry (and a scripted stale 404 for 010),
//   - LB POST: captured + fulfilled, asserting the AC-04 wire contract,
//   - LB list: echoes the captured rule so the create confirm is
//     deterministic.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field, setField} from '../../helpers/form';

const LIST_RE = /\/netlox\/v1\/config\/ai\/model-profiles(\?.*)?$/;
const DETAIL_RE = /\/netlox\/v1\/config\/ai\/model-profiles\/[^/?]+(\?.*)?$/;
const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_POST_RE = /\/netlox\/v1\/config\/loadbalancer(\?.*)?$/;

const PROFILES = [
	{profileId: 'llama-both', gen: 4, baseModel: 'meta-llama/Llama-3-70B', aliasPolicy: 'base_model_only', supportedApis: ['completions', 'chat'], tokenizerSha256: 'b'.repeat(64)},
	{profileId: 'qwen3-chat', gen: 4, baseModel: 'Qwen/Qwen3-32B', aliasPolicy: 'list', allowedAliases: ['qwen-chat'], supportedApis: ['chat'], tokenizerSha256: 'a'.repeat(64)},
];
const REGISTRY = {registryGeneration: 4, setDigest: 'sha256:2f7c1e99aa04', profiles: PROFILES};

let instName: string;

interface Harness {
	postBodies: () => any[];
	listReads: () => number;
	setDetailStale: (stale: boolean) => void;
}

/** Deterministic world: registry fixture, capturable LB POST, echoing LB list. */
async function mockWorld(page: Page): Promise<Harness> {
	const posts: any[] = [];
	let listReads = 0;
	let detailStale = false;

	await page.route(DETAIL_RE, (route: Route) => {
		if (detailStale) {
			return route.fulfill({status: 404, contentType: 'application/json', body: JSON.stringify({message: 'profile not published'})});
		}
		const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
		const profile = PROFILES.find(entry => entry.profileId === id);
		if (!profile) return route.fulfill({status: 404, contentType: 'application/json', body: JSON.stringify({message: 'not found'})});
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(profile)});
	});
	await page.route(LIST_RE, (route: Route) => {
		listReads += 1;
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(REGISTRY)});
	});
	await page.route(LB_ALL_RE, (route: Route) => route.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({lbAttr: posts.slice(-1)}),
	}));
	await page.route(LB_POST_RE, (route: Route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		posts.push(route.request().postDataJSON());
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({result: 'Success'})});
	});

	return {postBodies: () => posts, listReads: () => listReads, setDetailStale: s => { detailStale = s; }};
}

/** Fill a coherent strict P/D+KV-exact rule up to a submittable state. */
async function fillStrictRule(page: Page, name: string) {
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	await field(page, 'Rule Name').fill(name);
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.80');
	await field(page, 'Port Min').fill('18080');
	const adv = await expandSection(page, /^Advanced Settings/);
	void adv;
	await selectOption(page, 'Mode', 'fullproxy');

	const aigw = await expandSection(page, /^AI Gateway/);
	await field(page, 'Model Name', aigw).fill('qwen-chat');
	await selectOption(page, 'Topology', 'P/D + KV exact');
	await setField(page, 'KV Block Size', '16', aigw);
	await field(page, 'Block/Page Size Confirmed', aigw).check();

	const sec = await expandSection(page, /^Endpoints$/);
	const endpoints = [
		{ip: '198.51.100.81', role: 'prefill'},
		{ip: '198.51.100.82', role: 'decode'},
	];
	for (let i = 0; i < endpoints.length; i++) {
		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).nth(i).fill(endpoints[i].ip);
		await field(page, 'Target Port', sec).nth(i).fill('8000');
		await selectOption(page, 'EP Role', endpoints[i].role, i);
	}
	return aigw;
}

test.describe('@gw Model Profile selector — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
	});

	test('MP-E2E-006/007: base/alias matching filters and annotates the options', async ({page}) => {
		await mockWorld(page);
		const aigw = await fillStrictRule(page, 'e2e-mp-filter');

		// model_name = "qwen-chat" (an ALIAS): only the serving profile is
		// offered, with the alias context; the incompatible one is filtered out.
		await dialog(page).getByRole('combobox', {name: /^Model Profile/}).click();
		const listbox = page.getByRole('listbox');
		await expect(listbox.getByRole('option', {name: /qwen3-chat — Qwen\/Qwen3-32B — chat \(alias: qwen-chat\)/})).toBeVisible();
		await expect(listbox.getByRole('option', {name: /llama-both/})).toHaveCount(0);
		await expect(listbox.getByRole('option', {name: /None \(legacy profile-less routing\)/})).toBeVisible();
		await page.keyboard.press('Escape');

		// Base-model matching: clear the alias, use the base model name.
		await field(page, 'Model Name', aigw).fill('meta-llama/Llama-3-70B');
		await dialog(page).getByRole('combobox', {name: /^Model Profile/}).click();
		await expect(page.getByRole('option', {name: /llama-both — meta-llama\/Llama-3-70B — completions\/chat/})).toBeVisible();
		await expect(page.getByRole('option', {name: /qwen3-chat/})).toHaveCount(0);
		await page.keyboard.press('Escape');
		await dialogButton(page, 'Cancel').click();
	});

	test('MP-E2E-008: model/profile mismatch blocks the POST at field level', async ({page}) => {
		const world = await mockWorld(page);
		const aigw = await fillStrictRule(page, 'e2e-mp-mismatch');

		await selectOption(page, 'Model Profile', /^qwen3-chat — /);
		// Now break the coherence: a model the profile does not serve.
		await field(page, 'Model Name', aigw).fill('other/model');

		await expect(dialog(page).getByText(/does not serve model other\/model/)).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();
		await dialogButton(page, 'Cancel').click();
		expect(world.postBodies(), 'no POST may leave the browser on a blocked mismatch').toEqual([]);
	});

	test('MP-E2E-009: valid strict submit carries exactly the two scalar fields', async ({page}) => {
		const world = await mockWorld(page);
		await fillStrictRule(page, 'e2e-mp-strict');

		await selectOption(page, 'Model Profile', /^qwen3-chat — /);
		// Single-surface profile: the API surface preselects to "chat".
		await expect(dialog(page).getByRole('combobox', {name: /^API Surface/})).toHaveText(/chat/);

		await page.mouse.move(0, 0);
		const [body] = await Promise.all([
			page.waitForRequest(rq => rq.method() === 'POST' && LB_POST_RE.test(rq.url())).then(rq => rq.postDataJSON()),
			dialogButton(page, 'Create').click(),
		]);

		// AC-04: exact scalar serialization, no hidden defaults.
		expect(body.serviceArguments.kvModelProfile).toBe('qwen3-chat');
		expect(body.serviceArguments.kvExactApiMode).toBe('chat');
		expect(typeof body.serviceArguments.kvModelProfile).toBe('string');
		expect(typeof body.serviceArguments.kvExactApiMode).toBe('string');
		expect(body.serviceArguments.kvExactMode).toBe(1);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-010: a stale selection blocks the POST, keeps the draft, refreshes the registry', async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of 404/i);
		consoleGuard.allow(/Failed to load resource/i);
		const world = await mockWorld(page);
		await fillStrictRule(page, 'e2e-mp-stale');
		await selectOption(page, 'Model Profile', /^qwen3-chat — /);

		// The registry reloads between selection and submit: the submit-time
		// freshness read now answers 404.
		const listReadsBefore = world.listReads();
		world.setDetailStale(true);

		await page.mouse.move(0, 0);
		await dialogButton(page, 'Create').click();

		// No success, no POST; an honest error names the cause.
		await expect(page.getByText(/no longer published/)).toBeVisible({timeout: 15_000});
		expect(world.postBodies(), 'stale selection must never POST').toEqual([]);
		await page.getByRole('button', {name: 'OK'}).click();

		// The draft survives: the dialog is back with the operator's values.
		await expect(dialog(page)).toBeVisible();
		await expect(field(page, 'Rule Name')).toHaveValue('e2e-mp-stale');
		// And the registry was refetched for the reopened selector.
		await expect.poll(() => world.listReads(), {message: 'profiles refetch after stale rejection'}).toBeGreaterThan(listReadsBefore);
		await dialogButton(page, 'Cancel').click();
	});
});
