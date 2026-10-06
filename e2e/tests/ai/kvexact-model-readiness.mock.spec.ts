//---------------------------------------------------------
// KV-exact readiness for ONE model in the browser — mock contract layer
// (KVM-E2E-01..05).
//---------------------------------------------------------
// Asked with `?model_name=`, the gateway's `kv_exact_vllm` verdict also says
// whether a tokenizer for that model can be loaded. The LB form reads it for
// the name in Model Name and warns; it never blocks, because the gateway
// checks again on submit.
//
// The capability read is intercepted per model name, so every answer is
// deterministic. `/meta` and `/version` stay real, so the form body and the
// flavor gate are the real ones.
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field, setField} from '../../helpers/form';
import {CAP_KV_EXACT_VLLM, capsBody, KV_EXACT_TOKENIZER_SENTENCE, mockCapabilitiesByModel} from '../../helpers/capabilities';

const LB_POST_RE = /\/netlox\/v1\/config\/loadbalancer(\?.*)?$/;
const CAPS_PATH = /\/netlox\/v1\/status\/capabilities$/;

const READY = {body: capsBody({name: CAP_KV_EXACT_VLLM, ready: true})};
const NO_TOKENIZER = {
	body: capsBody({name: CAP_KV_EXACT_VLLM, ready: false, reason_code: 'KV_EXACT_TOKENIZER_UNLOADABLE', reason: KV_EXACT_TOKENIZER_SENTENCE}),
};
const OUR_LINE = /would refuse a KV-exact rule for this model right now/;
/** Longer than the form's debounce (600 ms): a read that was going to be issued has been. */
const PAST_DEBOUNCE_MS = 1_500;

let instName: string;

/**
 * Open Add with fullproxy mode selected, so the AI Gateway controls are live.
 * Reloads past a dropped `/meta` or `/version` read: see `openAddDialogWithBody`
 * in kvexact-readiness.mock.spec.ts for the measured fault this guards.
 */
async function openAddAsL7(page: Page, attempts = 5) {
	for (let attempt = 1; ; attempt++) {
		try {
			await openToolbarDialog(page, 'Add', field(page, 'Rule Name'), {timeout: 20_000, attempts: 1});
			const aigw = await expandSection(page, /^AI Gateway/);
			await expect(field(page, 'Model Name', aigw)).toBeVisible({timeout: 15_000});
			break;
		} catch (err) {
			if (attempt >= attempts) throw new Error(`The LB Add dialog never became ready in ${attempts} attempts: ${(err as Error).message}`);
			await dialogButton(page, 'Cancel').click().catch(() => undefined);
			await page.reload();
		}
	}
	await field(page, 'Rule Name').fill('e2e-kv-model');
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.78');
	await field(page, 'Port Min').fill('18078');
	await expandSection(page, /^Advanced Settings/);
	await selectOption(page, 'Mode', 'fullproxy');
	return expandSection(page, /^AI Gateway/);
}

/** Fill what a KV-exact create still needs, and send it. */
async function completeAndCreate(page: Page) {
	const aigw = await expandSection(page, /^AI Gateway/);
	await setField(page, 'KV Block Size', '16', aigw);
	await field(page, 'Block/Page Size Confirmed', aigw).check();
	const eps = await expandSection(page, /^Endpoints$/);
	await eps.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', eps).first().fill('198.51.100.78');
	await field(page, 'Target Port', eps).first().fill('8000');
	// Never a block: whatever the model read said, the form can be sent.
	await expect(dialogButton(page, 'Create')).toBeEnabled();
	await dialogButton(page, 'Create').click();
}

/** Answer the create with the gateway's 412 and count the attempts. */
async function refuseCreate(page: Page): Promise<{count: () => number}> {
	let posts = 0;
	await page.route(LB_POST_RE, (route: Route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		posts += 1;
		return route.fulfill({status: 412, contentType: 'application/json', body: JSON.stringify({result: KV_EXACT_TOKENIZER_SENTENCE})});
	});
	return {count: () => posts};
}

async function dismissErrorKeepingForm(page: Page): Promise<void> {
	const errorHeading = page.getByRole('heading', {name: 'Error'});
	await expect(errorHeading).toBeVisible();
	const errorModal = page.locator('.MuiModal-root').filter({has: errorHeading}).last();
	await errorModal.getByRole('button', {name: 'OK', exact: true}).click();
	await expect(errorHeading).toHaveCount(0);
}

const modelReads = (names: string[]) => names.filter(name => name !== '');

test.describe('@gw KV-exact readiness for one model — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		// Same scoped allowance as kvexact-readiness.mock.spec.ts: only the live
		// `/meta` read may fail here, and the open helper reloads past it.
		for (const status of [500, 502, 504]) consoleGuard.allowRequest({status, path: /\/netlox\/v1\/meta$/});
		await page.goto(`instance/traffic/lb?name=${instName}`);
	});

	test('KVM-E2E-01: a model with no tokenizer is a warning, and the submit still reaches the gateway', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 412, path: /\/config\/loadbalancer$/});
		const caps = await mockCapabilitiesByModel(page, {'': READY, 'org/missing-model': NO_TOKENIZER});
		const create = await refuseCreate(page);

		const aigw = await openAddAsL7(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		await field(page, 'Model Name', aigw).fill('org/missing-model');

		// The gateway's sentence, verbatim: it names the staging path and the
		// profile alternative, which is all an operator can act on.
		const warning = dialog(page).getByRole('alert').filter({hasText: OUR_LINE});
		await expect(warning).toBeVisible();
		await expect(warning).toContainText(KV_EXACT_TOKENIZER_SENTENCE);
		await expect(warning).toHaveClass(/MuiAlert-\w*[Ww]arning/);
		expect(modelReads(caps.requested())).toEqual(['org/missing-model']);

		// Never a block: the tokenizer can be staged after this read.
		await completeAndCreate(page);
		await expect(page.getByText(/its deployment must change/)).toBeVisible({timeout: 20_000});
		expect(create.count()).toBe(1);
		await dismissErrorKeepingForm(page);
	});

	test('KVM-E2E-02: the gateway is asked about the settled name only, once', async ({page}) => {
		const caps = await mockCapabilitiesByModel(page, {'': READY, 'org/model': NO_TOKENIZER});

		const aigw = await openAddAsL7(page);
		await selectOption(page, 'Topology', 'P/D + KV exact');
		// Every prefix on the way is a name the gateway would have to probe.
		await field(page, 'Model Name', aigw).pressSequentially('org/model', {delay: 40});

		// The warning proves the read for the settled name landed.
		await expect(dialog(page).getByRole('alert').filter({hasText: OUR_LINE})).toBeVisible();
		expect(modelReads(caps.requested())).toEqual(['org/model']);
	});

	test('KVM-E2E-03: a late answer about an earlier name says nothing about the current one', async ({page}) => {
		const caps = await mockCapabilitiesByModel(page, {'': READY, 'org/a': {...NO_TOKENIZER, hold: true}, 'org/b': READY});
		const warning = dialog(page).getByRole('alert').filter({hasText: OUR_LINE});

		const aigw = await openAddAsL7(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		const model = field(page, 'Model Name', aigw);
		await model.fill('org/a');
		await expect.poll(() => caps.requested()).toContain('org/a');

		// The operator types on while org/a is still unanswered.
		await model.fill('org/b');
		await expect.poll(() => caps.answered()).toContain('org/b');
		caps.release('org/a');
		await expect.poll(() => caps.answered()).toContain('org/a');
		await expect(warning).toHaveCount(0);

		// Control: that answer was a refusal, and it does show for its own name.
		await model.fill('org/a');
		await expect(warning).toBeVisible();
	});

	test('KVM-E2E-04: only a vllm rule on an exact topology asks about its model', async ({page}) => {
		const caps = await mockCapabilitiesByModel(page, {'': READY, 'org/model': NO_TOKENIZER});
		const warning = dialog(page).getByRole('alert').filter({hasText: OUR_LINE});

		const aigw = await openAddAsL7(page);
		await field(page, 'Model Name', aigw).fill('org/model');

		// vllm, plain routing.
		await page.waitForTimeout(PAST_DEBOUNCE_MS);
		expect(modelReads(caps.requested()), 'plain routing').toEqual([]);

		await selectOption(page, 'Topology', 'P/D disaggregation');
		await page.waitForTimeout(PAST_DEBOUNCE_MS);
		expect(modelReads(caps.requested()), 'P/D without KV exact').toEqual([]);

		await selectOption(page, 'AI Engine', 'sglang');
		await selectOption(page, 'Topology', 'Single-role KV exact');
		await page.waitForTimeout(PAST_DEBOUNCE_MS);
		expect(modelReads(caps.requested()), 'sglang on an exact topology').toEqual([]);
		await expect(warning).toHaveCount(0);

		// Control: the same form does ask once the rule is vllm on that topology.
		await selectOption(page, 'AI Engine', 'vllm');
		await expect(warning).toBeVisible();
		expect(modelReads(caps.requested())).toEqual(['org/model']);
	});

	test('KVM-E2E-05: a model read that fails says nothing and blocks nothing', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 500, path: CAPS_PATH});
		consoleGuard.allowRequest({status: 412, path: /\/config\/loadbalancer$/});
		const caps = await mockCapabilitiesByModel(page, {'': READY, 'org/model': {status: 500, body: {message: 'probe failed'}}});
		const create = await refuseCreate(page);

		const aigw = await openAddAsL7(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		await field(page, 'Model Name', aigw).fill('org/model');
		await expect.poll(() => caps.answered()).toContain('org/model');

		await expect(dialog(page).getByRole('alert').filter({hasText: OUR_LINE})).toHaveCount(0);
		await expect(page.getByRole('heading', {name: 'Error'})).toHaveCount(0);
		// The exact topology is still on offer: a failed read withdraws nothing.
		await expect(dialog(page).getByRole('combobox', {name: /^Topology/})).toHaveText(/Single-role KV exact/);

		// The gateway stays the authority.
		await completeAndCreate(page);
		await expect(page.getByText(/its deployment must change/)).toBeVisible({timeout: 20_000});
		expect(create.count()).toBe(1);
		await dismissErrorKeepingForm(page);
	});
});
