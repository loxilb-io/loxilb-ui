//---------------------------------------------------------
// KV-exact readiness for one model against the live gateway (KVM-E2E-07).
//---------------------------------------------------------
// What the form says about a model must be what the gateway says about it,
// read at the same moment.
//
// ⚠️ The gateway answers the launch seed BEFORE it probes a tokenizer. On a
// gateway launched without LLB_KV_NONE_HASH_SEED only the first case can run;
// the tokenizer case skips with that reason, and a skip is not a pass.
import type {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gwJson} from '../../helpers/api';
import {dialog, dialogButton, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';

/** A name no deployment stages a tokenizer for. */
const MODEL = 'e2e/no-such-model';
const OUR_LINE = /would refuse a KV-exact rule for this model right now/;

type Verdict = {name: string; ready: boolean; reason?: string; reason_code?: string};

async function gatewayVerdict(model?: string): Promise<Verdict | undefined> {
	const query = model ? `?model_name=${encodeURIComponent(model)}` : '';
	const body = await gwJson<{capabilities?: Verdict[]}>(`/status/capabilities${query}`);
	return body.capabilities?.find(c => c.name === 'kv_exact_vllm');
}

/** `model_name` of every capability read the page got an answer to; '' named no model. */
function watchCapabilityReads(page: Page): string[] {
	const answered: string[] = [];
	page.on('response', resp => {
		const url = new URL(resp.url());
		if (url.pathname.endsWith('/netlox/v1/status/capabilities')) answered.push(url.searchParams.get('model_name') ?? '');
	});
	return answered;
}

async function openAddAsL7(page: Page) {
	await openToolbarDialog(page, 'Add', field(page, 'Rule Name'));
	await expandSection(page, /^Advanced Settings/);
	await selectOption(page, 'Mode', 'fullproxy');
	const aigw = await expandSection(page, /^AI Gateway/);
	await expect(field(page, 'Model Name', aigw)).toBeVisible();
	return aigw;
}

test.describe('@gw KV-exact readiness for one model (live)', () => {
	let instName: string;
	let seed: Verdict | undefined;

	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		seed = await gatewayVerdict();
	});

	test('KVM-E2E-07a: a gateway that refuses KV-exact outright is not asked about a model', async ({page}) => {
		test.skip(!seed, 'this gateway does not report kv_exact_vllm');
		test.skip(seed!.ready, 'this gateway can serve KV-exact; the tokenizer case covers it');

		const answered = watchCapabilityReads(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const aigw = await openAddAsL7(page);
		// The form's own model-independent read must have landed.
		await expect.poll(() => answered).toContain('');

		// The gateway's answer for a named model is the same refusal, so the
		// form says it once, at the topology, and names no model to the gateway.
		const named = await gatewayVerdict(MODEL);
		expect(named?.ready).toBe(false);
		expect(named?.reason_code).toBe(seed!.reason_code);

		await field(page, 'Model Name', aigw).fill(MODEL);
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toBeVisible();
		if (seed!.reason) await expect(dialog(page).getByText(seed!.reason, {exact: true})).toBeVisible();
		await dialog(page).getByRole('combobox', {name: /^Topology/}).click();
		await expect(page.getByRole('option', {name: 'Plain routing'})).toBeVisible();
		await expect(page.getByRole('option', {name: /KV exact/})).toHaveCount(0);
		await page.keyboard.press('Escape');

		await expect(dialog(page).getByRole('alert').filter({hasText: OUR_LINE})).toHaveCount(0);
		expect(answered.filter(name => name !== '')).toEqual([]);
		await dialogButton(page, 'Cancel').click();
	});

	test('KVM-E2E-07b: the warning for a model equals the gateway verdict for that model', async ({page}) => {
		test.skip(!seed, 'this gateway does not report kv_exact_vllm');
		test.skip(
			!seed!.ready,
			`this gateway refuses KV-exact before it probes a tokenizer (${seed!.reason_code ?? 'no reason code'}); relaunch it with LLB_KV_NONE_HASH_SEED to run the tokenizer half`,
		);

		const answered = watchCapabilityReads(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const aigw = await openAddAsL7(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		await field(page, 'Model Name', aigw).fill(MODEL);
		// The form's read for this model must have landed before it is judged.
		await expect.poll(() => answered).toContain(MODEL);

		const named = (await gatewayVerdict(MODEL))!;
		const warning = dialog(page).getByRole('alert').filter({hasText: OUR_LINE});
		if (named.ready) {
			await expect(warning).toHaveCount(0);
		} else {
			await expect(warning).toBeVisible();
			if (named.reason) await expect(warning).toContainText(named.reason);
		}
		await dialogButton(page, 'Cancel').click();
	});
});
