//---------------------------------------------------------
// Strict-rule option matrix — mock contract layer (MP-E2E-023..029).
//
// The base selector behaviors (filter/annotate, mismatch block, two-scalar
// wire contract, stale rejection) are pinned in profile-selector.mock.spec.
// This file pins the COMBINATIONS the option space opens up: API-surface
// explicitness on multi-surface profiles, exact-match alias policy edges,
// the block-size confirmation gate on both strict topologies, stale strict
// state never leaking into a legacy POST, forward-compat with unknown
// registry surfaces, and engine × topology interactions. MP-E2E-035..039
// replay real fleet shapes proven in the gateway's CI/CD campaigns
// (converged llama.cpp CHWBL, SGLang P/D bootstrap, TRT-LLM role'd P/D,
// hash-pinned failover, vLLM NIXL P/D) and pin their wire bodies. Every
// gateway endpoint the flow touches is intercepted; no rule ever reaches
// the real gateway.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field, section, setField} from '../../helpers/form';

const LIST_RE = /\/netlox\/v1\/config\/ai\/model-profiles(\?.*)?$/;
const DETAIL_RE = /\/netlox\/v1\/config\/ai\/model-profiles\/[^/?]+(\?.*)?$/;
const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_POST_RE = /\/netlox\/v1\/config\/loadbalancer(\?.*)?$/;

const PROFILES = [
	{profileId: 'llama-both', gen: 4, baseModel: 'meta-llama/Llama-3-70B', aliasPolicy: 'base_model_only', supportedApis: ['completions', 'chat'], tokenizerSha256: 'b'.repeat(64)},
	{profileId: 'qwen3-chat', gen: 4, baseModel: 'Qwen/Qwen3-32B', aliasPolicy: 'list', allowedAliases: ['qwen-chat'], supportedApis: ['chat'], tokenizerSha256: 'a'.repeat(64)},
	// A registry entry from a NEWER gateway: an unknown API surface plus
	// fields this UI has never heard of. The open-vocabulary contract says
	// this must degrade to the known subset, never crash the selector.
	{profileId: 'nova-future', gen: 4, baseModel: 'nova/NovaLM-8B', aliasPolicy: 'base_model_only', supportedApis: ['chat', 'embeddings'], tokenizerSha256: 'c'.repeat(64), evidenceTier: 'gold', futureKnob: {nested: true}},
];
const REGISTRY = {registryGeneration: 4, setDigest: 'sha256:2f7c1e99aa04', profiles: PROFILES};

let instName: string;

/** Deterministic world: registry fixture, capturable LB POST, echoing LB list. */
async function mockWorld(page: Page): Promise<{postBodies: () => any[]}> {
	const posts: any[] = [];

	await page.route(DETAIL_RE, (route: Route) => {
		const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
		const profile = PROFILES.find(entry => entry.profileId === id);
		if (!profile) return route.fulfill({status: 404, contentType: 'application/json', body: JSON.stringify({message: 'not found'})});
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(profile)});
	});
	await page.route(LIST_RE, (route: Route) => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(REGISTRY)}));
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

	return {postBodies: () => posts};
}

/**
 * Fill the non-AI scaffolding of a fullproxy rule (name/VIP/port/mode/
 * endpoints) and expand the AI section. AI-side choices stay with the test —
 * the matrix under test IS those choices.
 */
async function fillRuleScaffold(page: Page, name: string, opts: {addEndpoints?: boolean} = {}) {
	const {addEndpoints = true} = opts;
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	await field(page, 'Rule Name').fill(name);
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.80');
	await field(page, 'Port Min').fill('18080');
	await expandSection(page, /^Advanced Settings/);
	await selectOption(page, 'Mode', 'fullproxy');

	const aigw = await expandSection(page, /^AI Gateway/);

	const sec = await expandSection(page, /^Endpoints$/);
	if (addEndpoints) {
		const endpoints = [
			{ip: '198.51.100.81', role: 'prefill'},
			{ip: '198.51.100.82', role: 'decode'},
		];
		for (let i = 0; i < endpoints.length; i++) {
			await sec.getByRole('button', {name: 'Add', exact: true}).click();
			await field(page, 'IP', sec).nth(i).fill(endpoints[i].ip);
			await field(page, 'Target Port', sec).nth(i).fill('8000');
		}
	}
	return {aigw, sec};
}

/** Set P/D endpoint roles once the topology has made the EP Role field appear. */
async function assignPdRoles(page: Page) {
	await selectOption(page, 'EP Role', 'prefill', 0);
	await selectOption(page, 'EP Role', 'decode', 1);
}

/**
 * Clear every endpoint's P/D role back to 'normal'. A cleared role hides its
 * row's EP Role dropdown (the field renders only under P/D or while a stale
 * role needs clearing), so the remaining dropdowns reindex — always clear at
 * index 0 until none are left.
 */
async function clearPdRoles(page: Page) {
	const roleBoxes = dialog(page).getByRole('combobox', {name: /^EP Role/});
	for (let guard = 0; guard < 8 && (await roleBoxes.count()) > 0; guard++) {
		await selectOption(page, 'EP Role', 'normal', 0);
	}
	await expect(roleBoxes).toHaveCount(0);
}

async function submitAndCapture(page: Page): Promise<any> {
	await page.mouse.move(0, 0);
	const [body] = await Promise.all([
		page.waitForRequest(rq => rq.method() === 'POST' && LB_POST_RE.test(rq.url())).then(rq => rq.postDataJSON()),
		dialogButton(page, 'Create').click(),
	]);
	return body;
}

test.describe('@gw Strict-rule option matrix — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
	});

	test('MP-E2E-023: a dual-surface profile demands an explicit API surface — no silent default', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-dual');
		await field(page, 'Model Name', aigw).fill('meta-llama/Llama-3-70B');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		await selectOption(page, 'Model Profile', /^llama-both — /);

		// Both surfaces declared → nothing preselects; the form says WHY the
		// submit is blocked and the button agrees.
		await expect(dialog(page).getByText('Select the API surface this strict rule serves.')).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();

		// The full dual-surface option set is offered: each surface plus
		// "both" — and "both" only exists BECAUSE the profile declares both.
		await dialog(page).getByRole('combobox', {name: /^API Surface/}).click();
		const listbox = page.getByRole('listbox');
		for (const mode of ['completions', 'chat', 'both']) {
			await expect(listbox.getByRole('option', {name: mode, exact: true})).toBeVisible();
		}
		await listbox.getByRole('option', {name: 'both', exact: true}).click();

		const body = await submitAndCapture(page);
		expect(body.serviceArguments.kvModelProfile).toBe('llama-both');
		expect(body.serviceArguments.kvExactApiMode).toBe('both');
		expect(body.serviceArguments.kvExactMode).toBe(1);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-024: model matching is exact and policy-scoped — no substring, no case folding, no alias on base_model_only', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-exact');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);

		const openProfileOptions = async () => {
			await dialog(page).getByRole('combobox', {name: /^Model Profile/}).click();
			return page.getByRole('listbox');
		};
		const noneOption = /None \(legacy profile-less routing\)/;

		// Substring of a base model must not match: fuzzy admission here would
		// bind a profile the gateway will refuse.
		await field(page, 'Model Name', aigw).fill('Llama-3-70B');
		let listbox = await openProfileOptions();
		await expect(listbox.getByRole('option', {name: noneOption})).toBeVisible();
		await expect(listbox.getByRole('option', {name: /llama-both|qwen3-chat|nova-future/})).toHaveCount(0);
		await page.keyboard.press('Escape');

		// Alias matching is case-sensitive exact — the served-model key the
		// gateway admits is a literal string, and the selector must agree.
		await field(page, 'Model Name', aigw).fill('QWEN-CHAT');
		listbox = await openProfileOptions();
		await expect(listbox.getByRole('option', {name: noneOption})).toBeVisible();
		await expect(listbox.getByRole('option', {name: /qwen3-chat/})).toHaveCount(0);
		await page.keyboard.press('Escape');

		// The exact alias, exactly cased, is admitted — same dialog, so the
		// two refusals above cannot be blamed on a broken selector.
		await field(page, 'Model Name', aigw).fill('qwen-chat');
		listbox = await openProfileOptions();
		await expect(listbox.getByRole('option', {name: /qwen3-chat — .* \(alias: qwen-chat\)/})).toBeVisible();
		await page.keyboard.press('Escape');

		await dialogButton(page, 'Cancel').click();
		expect(world.postBodies(), 'an options-probe dialog must never POST').toEqual([]);
	});

	test('MP-E2E-025: the block-size confirmation gates BOTH strict topologies, and single-role serializes kvExactMode 3', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-blocksz');
		await field(page, 'Model Name', aigw).fill('qwen-chat');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '16', aigw);
		await selectOption(page, 'Model Profile', /^qwen3-chat — /);

		// Everything else is coherent — the ONLY thing missing is the human
		// attestation that the block/page size matches the live engine.
		await expect(dialog(page).getByText(/Confirm that the KV block\/page size matches the live engine/)).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();

		await field(page, 'Block/Page Size Confirmed', aigw).check();
		await expect(dialogButton(page, 'Create')).toBeEnabled();

		// Same gate, other strict topology: single-role KV exact is mode 3 on
		// the wire, with the SAME profile binding carried over. The P/D roles
		// the endpoints still carry are now invalid — the form must SAY so
		// (actionable, field still visible) rather than silently strip them.
		await selectOption(page, 'Topology', 'Single-role KV exact');
		await expect(dialog(page).getByText('Single-role topology requires role-less endpoints.')).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();
		await clearPdRoles(page);

		// The confirmation deliberately does NOT survive the topology change —
		// the human attestation is per-composition, so the gate re-engages and
		// must be re-earned.
		await expect(dialog(page).getByText(/Confirm that the KV block\/page size matches the live engine/)).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		const body = await submitAndCapture(page);
		expect(body.serviceArguments.kvExactMode).toBe(3);
		expect(body.serviceArguments.kvModelProfile).toBe('qwen3-chat');
		expect(body.serviceArguments.kvExactApiMode).toBe('chat');
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-026: strict state abandoned in the form never leaks into a plain-routing POST', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-legacy');

		// Walk INTO a fully-bound strict draft first — then walk back out.
		// A naive serializer would ship the leftovers.
		await field(page, 'Model Name', aigw).fill('qwen-chat');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();
		await selectOption(page, 'Model Profile', /^qwen3-chat — /);
		await selectOption(page, 'Topology', 'Plain routing');
		// Plain routing refuses P/D roles with an actionable message; clear
		// them the way an operator would.
		await expect(dialog(page).getByText('Plain topology requires role-less endpoints.')).toBeVisible();
		await clearPdRoles(page);

		const body = await submitAndCapture(page);
		// Absent means ABSENT: the admission contract distinguishes a missing
		// key from an empty one, so hasOwnProperty is the assertion, not
		// falsiness.
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'kvModelProfile')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'kvExactApiMode')).toBe(false);
		expect(body.serviceArguments.kvExactMode ?? 0).toBe(0);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-027: a newer gateway\'s unknown API surface degrades to the known subset — selectable, no crash', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-future');
		await field(page, 'Model Name', aigw).fill('nova/NovaLM-8B');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		// The future-shaped profile is offered and selectable.
		await selectOption(page, 'Model Profile', /^nova-future — /);

		// 'embeddings' is unknown to this UI: the surface list degrades to the
		// known subset — one known surface left, so it preselects — and 'both'
		// must NOT appear (chat+embeddings is not chat+completions).
		await expect(dialog(page).getByRole('combobox', {name: /^API Surface/})).toHaveText(/chat/);
		await dialog(page).getByRole('combobox', {name: /^API Surface/}).click();
		const listbox = page.getByRole('listbox');
		await expect(listbox.getByRole('option', {name: 'chat', exact: true})).toBeVisible();
		await expect(listbox.getByRole('option', {name: /embeddings|both/})).toHaveCount(0);
		await page.keyboard.press('Escape');

		const body = await submitAndCapture(page);
		expect(body.serviceArguments.kvModelProfile).toBe('nova-future');
		expect(body.serviceArguments.kvExactApiMode).toBe('chat');
		expect(world.postBodies()).toHaveLength(1);
		// consoleGuard (fixture default): any console error from the unknown
		// fields fails this test on teardown.
	});

	test('MP-E2E-028: engine choice constrains the topology space, and switching to llamacpp dissolves a strict draft', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-engine');
		await field(page, 'Model Name', aigw).fill('qwen-chat');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();
		await selectOption(page, 'Model Profile', /^qwen3-chat — /);

		// trtllm serves KV-exact but not plain P/D disaggregation.
		await selectOption(page, 'AI Engine', 'trtllm');
		await dialog(page).getByRole('combobox', {name: /^Topology/}).click();
		let listbox = page.getByRole('listbox');
		await expect(listbox.getByRole('option', {name: 'P/D + KV exact'})).toBeVisible();
		await expect(listbox.getByRole('option', {name: 'P/D disaggregation', exact: true})).toHaveCount(0);
		await page.keyboard.press('Escape');

		// llamacpp serves neither: the engine change collapses the topology to
		// plain routing and the profile binding must dissolve WITH it — a
		// strict binding without a strict data plane is exactly the state the
		// gateway refuses.
		await selectOption(page, 'AI Engine', 'llamacpp');
		await expect(dialog(page).getByRole('combobox', {name: /^Topology/})).toHaveText(/Plain routing/);
		await dialog(page).getByRole('combobox', {name: /^Topology/}).click();
		listbox = page.getByRole('listbox');
		await expect(listbox.getByRole('option', {name: 'Plain routing'})).toBeVisible();
		await expect(listbox.getByRole('option')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(dialog(page).getByRole('combobox', {name: /^Model Profile/})).toHaveCount(0);

		// The role-less rule the collapsed topology demands: clear the stale
		// P/D roles the way an operator would.
		await expect(dialog(page).getByText('Plain topology requires role-less endpoints.')).toBeVisible();
		await clearPdRoles(page);

		const body = await submitAndCapture(page);
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'kvModelProfile')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'kvExactApiMode')).toBe(false);
		expect(body.serviceArguments.kvExactMode ?? 0).toBe(0);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-029: the add dialog is wide with all six sections and fixed actions', async ({page}) => {
		await mockWorld(page);
		await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');

		// The LB dialog opts into the wide size (880px under a 1280px
		// viewport); a regression to the 500px default re-cramps the heaviest
		// form in the app.
		const box = await dialog(page).boundingBox();
		expect(box, 'dialog must render with a measurable box').not.toBeNull();
		expect(box!.width).toBeGreaterThanOrEqual(860);

		for (const title of [/^Basic Settings/, /^Advanced Settings/, /^AI Gateway/, /^Secondary IPs$/, /^Allowed Sources$/, /^Endpoints$/]) {
			await expect(section(page, title)).toBeVisible();
		}
		// Action buttons are part of the fixed footer — visible without any
		// scrolling even before sections expand.
		await expect(dialogButton(page, 'Create')).toBeVisible();
		await expect(dialogButton(page, 'Cancel')).toBeVisible();
		await dialogButton(page, 'Cancel').click();
	});

	test('MP-E2E-030: P/D disaggregation — a fresh endpoint row survives having its ROLE set before its IP', async ({page}) => {
		const world = await mockWorld(page);
		const {sec} = await fillRuleScaffold(page, 'e2e-mp-mx-pd', {addEndpoints: false});
		await selectOption(page, 'Topology', 'P/D disaggregation');

		// The natural operator order under P/D: add a row, declare WHAT it is
		// (prefill/decode), then say where it lives. Editing any field of a
		// row whose IP is still empty must not delete the row.
		const roles = ['prefill', 'decode'] as const;
		for (let i = 0; i < roles.length; i++) {
			await sec.getByRole('button', {name: 'Add', exact: true}).click();
			await selectOption(page, 'EP Role', roles[i], i);
			await expect(field(page, 'IP', sec).nth(i), `row ${i} must survive its role being set first`).toBeVisible();
			await field(page, 'IP', sec).nth(i).fill(`198.51.100.8${i + 1}`);
			await field(page, 'Target Port', sec).nth(i).fill('8000');
		}

		const body = await submitAndCapture(page);
		expect(body.serviceArguments.pd_disagg_mode).toBe(true);
		expect((body.serviceArguments.kvExactMode ?? 0)).toBe(0);
		expect(body.endpoints.map((ep: any) => ep.ep_role)).toEqual([1, 2]);
		// Plain P/D is NOT strict: no profile keys may ride along.
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'kvModelProfile')).toBe(false);
		// Untouched CHWBL fields are ABSENT — before F-CHWBL the level
		// dropdown's announce shipped level 1 on every fullproxy rule.
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'chwbl_prefix_hash_level')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'chwbl_prefix_hash_flags')).toBe(false);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-031: engine × topology sweep — option sets and combo-scoped fields across the full matrix', async ({page}) => {
		test.setTimeout(120_000);
		await mockWorld(page);
		const {aigw, sec} = await fillRuleScaffold(page, 'e2e-mp-mx-sweep', {addEndpoints: false});
		// One IP'd endpoint so per-row fields (EP Role / NIXL Port) are
		// observable in every combination.
		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).fill('198.51.100.90');
		await field(page, 'Target Port', sec).fill('8000');

		// UI topology offer per engine (topologyOptions contract).
		const OFFER: Record<string, string[]> = {
			vllm: ['Plain routing', 'P/D disaggregation', 'P/D + KV exact', 'Single-role KV exact'],
			sglang: ['Plain routing', 'P/D disaggregation', 'P/D + KV exact', 'Single-role KV exact'],
			trtllm: ['Plain routing', 'P/D + KV exact', 'Single-role KV exact'],
			llamacpp: ['Plain routing'],
		};
		const isPd = (topo: string) => topo === 'P/D disaggregation' || topo === 'P/D + KV exact';
		const isExact = (topo: string) => topo.includes('KV exact');

		for (const engine of ['vllm', 'sglang', 'trtllm', 'llamacpp']) {
			// Normalize before each engine so the switch never lands on a
			// topology the next engine does not offer.
			await selectOption(page, 'Topology', 'Plain routing');
			await selectOption(page, 'AI Engine', engine);

			// The offer is EXACT: nothing missing, nothing extra.
			await dialog(page).getByRole('combobox', {name: /^Topology/}).click();
			const listbox = page.getByRole('listbox');
			await expect(listbox.getByRole('option')).toHaveCount(OFFER[engine].length);
			for (const topo of OFFER[engine]) {
				await expect(listbox.getByRole('option', {name: topo, exact: true})).toBeVisible();
			}
			await page.keyboard.press('Escape');

			for (const topo of OFFER[engine]) {
				await selectOption(page, 'Topology', topo);

				// P/D-scoped tuning surfaces exactly with a P/D topology.
				await expect(field(page, 'P/D Cache-Aware Mode', aigw)).toHaveCount(isPd(topo) ? 1 : 0);
				await expect(field(page, 'P/D Bootstrap Port', aigw)).toHaveCount(isPd(topo) && engine === 'sglang' ? 1 : 0);

				// Exact-routing block: size + human confirmation on both strict
				// topologies; event transport fields follow the engine.
				await expect(field(page, 'KV Block Size', aigw)).toHaveCount(isExact(topo) ? 1 : 0);
				await expect(field(page, 'Block/Page Size Confirmed', aigw)).toHaveCount(isExact(topo) ? 1 : 0);
				await expect(field(page, 'KV ZMQ Port', aigw)).toHaveCount(isExact(topo) && (engine === 'vllm' || engine === 'sglang') ? 1 : 0);
				await expect(field(page, 'KV DP Rank Count', aigw)).toHaveCount(isExact(topo) && engine === 'sglang' ? 1 : 0);

				// Per-endpoint fields: EP Role under P/D; NIXL only for vLLM P/D.
				await expect(field(page, 'EP Role', sec)).toHaveCount(isPd(topo) ? 1 : 0);
				await expect(field(page, 'NIXL Port', sec)).toHaveCount(isPd(topo) && engine === 'vllm' ? 1 : 0);
			}
		}
		await dialogButton(page, 'Cancel').click();
	});

	test('MP-E2E-032: KV cache-aware knobs enforce their contract ranges at the field level', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-cachebounds');
		// CHWBL fields are selector-scoped (F-CHWBL): pick the chwbl algorithm
		// so the bounds are what is under test, not the selector guard.
		await selectOption(page, 'SEL', 'chwbl');
		await selectOption(page, 'Topology', 'P/D disaggregation');
		await assignPdRoles(page);

		// Out-of-range → the exact contract message + Create disabled; back on
		// the boundary → the message clears. (CHWBL hash LEVEL is a closed
		// dropdown — its invalid values are unreachable by construction.)
		const cases = [
			{label: 'CHWBL Prefix Hash Flags', bad: '256', good: '255', message: 'CHWBL prefix hash flags must be an integer between 0 and 255.'},
			{label: 'P/D Cache Threshold', bad: '101', good: '100', message: 'P/D cache threshold must be an integer between 0 and 100.'},
		];
		for (const {label, bad, good, message} of cases) {
			await setField(page, label, bad, aigw);
			await expect(dialog(page).getByText(message)).toBeVisible();
			await expect(dialogButton(page, 'Create')).toBeDisabled();
			await setField(page, label, good, aigw);
			await expect(dialog(page).getByText(message)).toHaveCount(0);
		}
		await expect(dialogButton(page, 'Create')).toBeEnabled();
		await dialogButton(page, 'Cancel').click();
		expect(world.postBodies(), 'a bounds-probe dialog must never POST').toEqual([]);
	});

	test('MP-E2E-033: a fully-tuned cache-aware P/D config reaches the wire verbatim — no field clobbers another', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-cachefull');
		await selectOption(page, 'SEL', 'chwbl');
		await selectOption(page, 'Topology', 'P/D disaggregation');
		await assignPdRoles(page);

		// Every cache-aware / session / streaming knob set in one dialog —
		// the delta-merge regression this pins: any full-snapshot write in a
		// subform would clobber a sibling set moments earlier.
		await field(page, 'SSE Mode', aigw).check();
		await field(page, 'P/D Cache-Aware Mode', aigw).check();
		await setField(page, 'Session Header Name', 'X-Session-Id', aigw);
		await selectOption(page, 'CHWBL Prefix Hash Level', '2');
		await setField(page, 'CHWBL Prefix Hash Flags', '128', aigw);
		await setField(page, 'P/D Session TTL (s)', '300', aigw);
		await setField(page, 'P/D Cache Threshold', '75', aigw);
		await setField(page, 'P/D Balance Abs Threshold', '5', aigw);
		await setField(page, 'Max Stream Duration (s)', '600', aigw);
		await setField(page, 'Backend Keepalive Interval (s)', '30', aigw);

		const body = await submitAndCapture(page);
		const sa = body.serviceArguments;
		expect(sa.sel).toBe(8);
		expect(sa.pd_disagg_mode).toBe(true);
		expect(sa.sse_mode).toBe(true);
		expect(sa.pd_cache_aware_mode).toBe(true);
		expect(sa.session_header_name).toBe('X-Session-Id');
		expect(sa.chwbl_prefix_hash_level).toBe(2);
		expect(sa.chwbl_prefix_hash_flags).toBe(128);
		expect(sa.pd_session_ttl_sec).toBe(300);
		expect(sa.pd_cache_threshold).toBe(75);
		expect(sa.pd_balance_abs_threshold).toBe(5);
		expect(sa.max_stream_duration_sec).toBe(600);
		expect(sa.backend_keepalive_interval_sec).toBe(30);
		expect(body.endpoints.map((ep: any) => ep.ep_role)).toEqual([1, 2]);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-034: CHWBL prefix hash settings are selector-scoped — blocked off chwbl, admitted on it (F-CHWBL)', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-chwbl');

		// Default selector is rr: a CHWBL setting here would be silently
		// dropped by the gateway (verified live), so the form must block with
		// the actionable message instead.
		await selectOption(page, 'CHWBL Prefix Hash Level', '2');
		const guard = dialog(page).getByText(/CHWBL prefix hash settings require the chwbl load-balancing algorithm/);
		await expect(guard).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();

		// Switching the algorithm — not clearing the value — is the other
		// legitimate way out; the guard lifts and the value survives.
		await selectOption(page, 'SEL', 'chwbl');
		await expect(guard).toHaveCount(0);
		await expect(dialogButton(page, 'Create')).toBeEnabled();

		// And back: the guard re-engages on the SAME visible field, so the
		// operator is never blocked by an invisible control.
		await selectOption(page, 'SEL', 'rr');
		await expect(guard).toBeVisible();
		await selectOption(page, 'CHWBL Prefix Hash Level', 'Not set');
		await expect(guard).toHaveCount(0);

		const body = await submitAndCapture(page);
		expect(Object.prototype.hasOwnProperty.call(body.serviceArguments, 'chwbl_prefix_hash_level')).toBe(false);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-035: converged llama.cpp CHWBL fleet — engine-agnostic method rule with health probes, no strict residue', async ({page}) => {
		const world = await mockWorld(page);
		const {sec} = await fillRuleScaffold(page, 'e2e-mp-mx-lcp', {addEndpoints: false});

		// The day-0 posture a converged llama.cpp fleet runs: plain LB +
		// content prefix-hash selection, streaming kept alive, HTTP health
		// probes — and NO kv*/pd* routing state at all.
		await selectOption(page, 'SEL', 'chwbl');
		await selectOption(page, 'AI Engine', 'llamacpp');
		await field(page, 'SSE Mode').check();
		await field(page, 'Enable Monitor').check();
		await selectOption(page, 'Probe Type', 'HTTP');
		await setField(page, 'Probe Port', '8081', sec);
		await setField(page, 'Probe Request', '/health', sec);
		await setField(page, 'Probe Retries', '1', sec);

		// Converged means role-less: every endpoint serves both phases.
		for (let i = 0; i < 3; i++) {
			await sec.getByRole('button', {name: 'Add', exact: true}).click();
			await field(page, 'IP', sec).nth(i).fill(`198.51.100.7${i + 1}`);
			await field(page, 'Target Port', sec).nth(i).fill('8081');
		}

		const body = await submitAndCapture(page);
		const sa = body.serviceArguments;
		expect(sa.sel).toBe(8);
		expect(sa.mode).toBe(4);
		expect(sa.kvEngineType).toBe('llamacpp');
		expect(sa.sse_mode).toBe(true);
		expect(sa.monitor).toBe(true);
		expect(sa.probetype).toBe('http');
		expect(sa.probeport).toBe(8081);
		expect(sa.probereq).toBe('/health');
		expect(sa.probeRetries).toBe(1);
		// The vhost key stays empty on purpose — keying it to the VIP breaks
		// clients whose Host header differs (floating/NAT'd external IPs).
		expect(sa.host ?? '').toBe('');
		// llamacpp offers only plain routing, so no strict or P/D state may
		// ride along — and CHWBL fields left untouched stay absent even when
		// the chwbl selector itself is active.
		for (const key of ['pd_disagg_mode', 'kvExactMode', 'kvModelProfile', 'chwbl_prefix_hash_level', 'chwbl_prefix_hash_flags']) {
			expect(Object.prototype.hasOwnProperty.call(sa, key), `${key} must be absent`).toBe(false);
		}
		expect(body.endpoints).toHaveLength(3);
		for (const ep of body.endpoints) {
			expect(ep.ep_role ?? 0).toBe(0);
			expect(ep.weight).toBe(1);
			expect(ep.targetPort).toBe(8081);
		}
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-036: SGLang P/D bootstrap fleet — profile-less KV-exact with the full transport tuple on the wire', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-sgl');
		await selectOption(page, 'AI Engine', 'sglang');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);

		// A role-partitioned SGLang fleet needs the whole transport tuple:
		// the disaggregation bootstrap port, the ZMQ event port, the page
		// size read back from the live engine, DP rank fan-out, and a warmup
		// hold before cache-aware picks engage.
		await field(page, 'SSE Mode', aigw).check();
		await setField(page, 'P/D Bootstrap Port', '8998', aigw);
		await setField(page, 'KV Block Size', '64', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();
		await setField(page, 'KV ZMQ Port', '5570', aigw);
		await setField(page, 'KV DP Rank Count', '2', aigw);
		await setField(page, 'KV Warmup (s)', '30', aigw);

		const body = await submitAndCapture(page);
		const sa = body.serviceArguments;
		expect(sa.kvEngineType).toBe('sglang');
		expect(sa.pd_disagg_mode).toBe(true);
		expect(sa.kvExactMode).toBe(1);
		expect(sa.pdBootstrapPort).toBe(8998);
		expect(sa.kvBlockSize).toBe(64);
		expect(sa.kvZmqPort).toBe(5570);
		expect(sa.kvDpRankCount).toBe(2);
		expect(sa.kvWarmupSec).toBe(30);
		expect(sa.sse_mode).toBe(true);
		// The fleets that predate the profile registry run strict routing
		// WITHOUT a profile binding — legacy profile-less admission must
		// stay composable, with both profile keys absent.
		expect(Object.prototype.hasOwnProperty.call(sa, 'kvModelProfile')).toBe(false);
		expect(Object.prototype.hasOwnProperty.call(sa, 'kvExactApiMode')).toBe(false);
		expect(body.endpoints.map((ep: any) => ep.ep_role)).toEqual([1, 2]);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-037: TRT-LLM role\'d P/D fleet — engine-foreign transport knobs stay off the wire', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw} = await fillRuleScaffold(page, 'e2e-mp-mx-trt');
		await selectOption(page, 'AI Engine', 'trtllm');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '32', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();
		await setField(page, 'KV Warmup (s)', '30', aigw);

		const body = await submitAndCapture(page);
		const sa = body.serviceArguments;
		expect(sa.kvEngineType).toBe('trtllm');
		expect(sa.pd_disagg_mode).toBe(true);
		expect(sa.kvExactMode).toBe(1);
		expect(sa.kvBlockSize).toBe(32);
		expect(sa.kvWarmupSec).toBe(30);
		// TRT-LLM subscribes its context workers over the polled HTTP drain:
		// ZMQ, the SGLang bootstrap port, and DP rank fan-out are meaningless
		// for this engine and MUST be absent — MP-E2E-031 pins that the
		// fields never render; this pins that nothing ships anyway.
		for (const key of ['kvZmqPort', 'pdBootstrapPort', 'kvDpRankCount']) {
			expect(Object.prototype.hasOwnProperty.call(sa, key), `${key} must be absent for trtllm`).toBe(false);
		}
		expect(body.endpoints.map((ep: any) => ep.ep_role)).toEqual([1, 2]);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-038: failover-QA hash-pinned rule — an explicit KV hash override survives to the wire beside probe tuning', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw, sec} = await fillRuleScaffold(page, 'e2e-mp-mx-hashpin');
		await selectOption(page, 'Topology', 'P/D + KV exact');
		await assignPdRoles(page);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		// The failover drills pin the hash algorithm explicitly instead of
		// trusting the engine default, shorten warmup, and run tight probes —
		// the shape that keeps the pre-detection window measurable.
		await selectOption(page, 'KV Hash Override', 'xxhash_cbor');
		await setField(page, 'KV ZMQ Port', '5558', aigw);
		await setField(page, 'KV Warmup (s)', '20', aigw);
		await field(page, 'Enable Monitor').check();
		await setField(page, 'Probe Retries', '1', sec);

		const body = await submitAndCapture(page);
		const sa = body.serviceArguments;
		expect(sa.kvHashAlgo).toBe('xxhash_cbor');
		expect(sa.pd_disagg_mode).toBe(true);
		expect(sa.kvExactMode).toBe(1);
		expect(sa.kvZmqPort).toBe(5558);
		expect(sa.kvWarmupSec).toBe(20);
		expect(sa.monitor).toBe(true);
		expect(sa.probeRetries).toBe(1);
		expect(world.postBodies()).toHaveLength(1);
	});

	test('MP-E2E-039: vLLM NIXL P/D fleet — per-endpoint side-channel ports ride the endpoints, baseline stays cache-blind', async ({page}) => {
		const world = await mockWorld(page);
		const {aigw, sec} = await fillRuleScaffold(page, 'e2e-mp-mx-nixl', {addEndpoints: false});
		await selectOption(page, 'Topology', 'P/D disaggregation');

		// vLLM P/D moves KV blocks over per-endpoint NIXL side channels; the
		// port is endpoint state, not rule state, and each row keeps its own.
		const rows = [
			{ip: '198.51.100.85', role: 'prefill', nixl: '5601'},
			{ip: '198.51.100.86', role: 'decode', nixl: '5602'},
		] as const;
		for (let i = 0; i < rows.length; i++) {
			await sec.getByRole('button', {name: 'Add', exact: true}).click();
			await field(page, 'IP', sec).nth(i).fill(rows[i].ip);
			await field(page, 'Target Port', sec).nth(i).fill('8000');
			await selectOption(page, 'EP Role', rows[i].role, i);
			await field(page, 'NIXL Port', sec).nth(i).fill(rows[i].nixl);
		}
		// The baseline drill shape: a session TTL for sticky decode picks,
		// but cache-aware routing deliberately OFF — every prefill pick is a
		// fresh min-load decision.
		await setField(page, 'P/D Session TTL (s)', '30', aigw);

		const body = await submitAndCapture(page);
		const sa = body.serviceArguments;
		expect(sa.pd_disagg_mode).toBe(true);
		expect(sa.pd_session_ttl_sec).toBe(30);
		expect(sa.pd_cache_aware_mode ?? false).toBe(false);
		expect(sa.kvExactMode ?? 0).toBe(0);
		expect(Object.prototype.hasOwnProperty.call(sa, 'kvModelProfile')).toBe(false);
		expect(body.endpoints.map((ep: any) => ep.ep_role)).toEqual([1, 2]);
		expect(body.endpoints.map((ep: any) => ep.nixl_port)).toEqual([5601, 5602]);
		expect(world.postBodies()).toHaveLength(1);
	});
});
