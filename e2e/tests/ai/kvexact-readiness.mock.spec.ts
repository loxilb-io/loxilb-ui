//---------------------------------------------------------
// KV-exact readiness in the browser — mock contract layer
// (B-01..B-08, C-01; see the note at the foot of the file for C-02).
//---------------------------------------------------------
// PR #125 made the LB form ask the gateway whether it can serve KV-exact
// instead of guessing from an error string. Unit and component tests cover
// the decision and the option list; NOTHING covered what an operator's
// browser actually renders.
//
// ⭐ No seeded gateway is needed. `GET /status/capabilities` is intercepted,
// so every readiness state — ready, not-ready, absent, malformed — is
// deterministic on the current testbed. Only `/version` stays real, so the
// flavor gate (hasAiFields) is genuinely exercised rather than mocked away.
//
// ⭐⭐ B-07 is the reason this file exists. See its comment.
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, expectErrorAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field, setField} from '../../helpers/form';
import {selectRowByText} from '../../helpers/table';
import {CAP_KV_EXACT_VLLM, capsBody, CapsHarness, KV_EXACT_SEED_SENTENCE, mockCapabilities} from '../../helpers/capabilities';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_POST_RE = /\/netlox\/v1\/config\/loadbalancer(\?.*)?$/;

// Both now live in helpers/capabilities.ts: this file and the option-matrix
// specs must intercept the SAME endpoint with the SAME sentence, and a private
// copy per file is precisely how profile-rule-matrix ended up with no stub at
// all. Aliased rather than renamed throughout to keep this diff reviewable.
const CAP = CAP_KV_EXACT_VLLM;
const GW_SENTENCE = KV_EXACT_SEED_SENTENCE;

const EXACT_OPTIONS = ['P/D + KV exact', 'Single-role KV exact'];

let instName: string;


/**
 * Open the LB Add dialog and wait until it is GENUINELY ready, reloading past
 * a measured testbed fault.
 *
 * ⚠️⚠️ THIS RETRY GUARDS AN INFRASTRUCTURE FAULT, NEVER AN ASSERTION.
 *
 * Measured 2026-09-22, same client, same minute:
 *   - gateway direct (`:11111/netlox/v1/meta`)  20/20 ok, median 71ms
 *   - OAM-local (`/loxilbs`, no gateway hop)    20/20 ok, median 38ms
 *   - OAM→gateway proxy                         ~1 in 10 FAILS, `502
 *     {"error":"LoxiLB instance unreachable"}` at a hard ~10.05s
 * It is NOT payload size: tiny `/version` failed 2/20 while 205KB `/meta`
 * failed 1/20. The fault is the OAM's proxy hop to the gateway.
 *
 * Two different reads the dialog needs both go through that hop, so a drop
 * has two faces and BOTH are silent:
 *   1. `/meta` fills `useFormWithParams` → without it the modal contains only
 *      Cancel and a disabled Create. No heading, no fields, no message.
 *   2. `/version` resolves the flavor → `hasAiFields` goes false and the
 *      AI-gateway fields vanish, leaving the plain-loxilb form against a
 *      gateway. That one cost a C-01 run: `KV Block Size` was simply absent.
 *
 * So readiness means BOTH landed: the Rule Name field proves `/meta`, and a
 * gateway-only field inside the AI Gateway section proves `/version`. A
 * reload re-issues both (`['metadata']` is `staleTime: Infinity`, one read per
 * page load), which makes it a clean retry.
 *
 * ⚠️ `attempts` is sized from the measured rate, not picked round. Readiness
 * needs BOTH reads, so one attempt succeeds with p ≈ 0.9 × 0.9 = 0.81. At 3
 * attempts a single case still fails 0.19³ ≈ 0.7% of the time, which over the
 * nine cases here is ~6% per run — and that is exactly what was observed (one
 * failure in roughly five full-file runs). At 5 it is 0.19⁵ ≈ 0.025% per case,
 * ~0.2% per run. The cost is only paid on a path that is already broken.
 */
async function openAddDialogWithBody(page: Page, attempts = 5): Promise<void> {
	for (let attempt = 1; ; attempt++) {
		try {
			// `/meta` landed → the form body exists.
			await openToolbarDialog(page, 'Add', field(page, 'Rule Name'), {timeout: 20_000, attempts: 1});
			// `/version` landed → the gateway-only fields exist. Model Name is
			// rendered under `hasAiFields`, so its presence is the flavor probe.
			const aigw = await expandSection(page, /^AI Gateway/);
			await expect(field(page, 'Model Name', aigw)).toBeVisible({timeout: 15_000});
			return;
		} catch (err) {
			if (attempt >= attempts) {
				throw new Error(
					`The LB Add dialog never became ready in ${attempts} attempts (each one reloads). ` +
						'Readiness needs GET /meta (form body) and GET /version (AI-gateway fields), both of ' +
						'which cross the OAM→gateway hop that drops ~1 request in 10 on this testbed. ' +
						'Probe both through the OAM before suspecting the UI. ' +
						`Underlying: ${(err as Error).message}`,
				);
			}
			await dialogButton(page, 'Cancel').click().catch(() => undefined);
			await page.reload();
		}
	}
}

/**
 * Open Add → drive the form to the point where Topology is live.
 *
 * Topology is `disabled={!isL7}`, so mode 4 is not decoration: without it the
 * control renders but cannot be opened, and every option assertion below
 * would pass vacuously against a disabled combobox.
 */
async function openAddToTopology(page: Page): Promise<void> {
	await openAddDialogWithBody(page);
	await field(page, 'Rule Name').fill('e2e-kv-readiness');
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.77');
	await field(page, 'Port Min').fill('18077');
	await expandSection(page, /^Advanced Settings/);
	await selectOption(page, 'Mode', 'fullproxy');
	const aigw = await expandSection(page, /^AI Gateway/);
	await field(page, 'Model Name', aigw).fill('Qwen/Qwen3-32B');
}

/** The Topology combobox. Its accessible name is "<label> <selected value>". */
function topologyBox(page: Page) {
	return dialog(page).getByRole('combobox', {name: /^Topology/});
}

/** Open the Topology listbox and return the option names it offers. */
async function topologyOptionNames(page: Page): Promise<string[]> {
	await topologyBox(page).click();
	const listbox = page.getByRole('listbox');
	await expect(listbox).toBeVisible();
	const names = await listbox.getByRole('option').allInnerTexts();
	await page.keyboard.press('Escape');
	await expect(listbox).toHaveCount(0);
	return names.map(n => n.trim());
}

/**
 * Dismiss the Error popup WITHOUT asserting the form behind it is gone.
 *
 * `expectErrorAndDismiss` ends with `expect(dialog(page)).toBeHidden()`, which
 * is correct everywhere a failure sends the operator back to the list. A
 * precondition refusal deliberately does not, so that helper would assert the
 * opposite of what this case is for. Anchored on the Error popup's own heading
 * rather than on modal order, because with the form reopened underneath there
 * are two modal roots mounted at once.
 */
async function dismissErrorKeepingForm(page: Page): Promise<void> {
	const errorHeading = page.getByRole('heading', {name: 'Error'});
	await expect(errorHeading).toBeVisible();
	const errorModal = page.locator('.MuiModal-root').filter({has: errorHeading}).last();
	await errorModal.getByRole('button', {name: 'OK', exact: true}).click();
	await expect(errorHeading).toHaveCount(0);
}

test.describe('@gw KV-exact readiness — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		// ⚠️ SCOPED TO THIS FILE, and it cannot mask a product defect here.
		// Every endpoint any assertion in this file depends on is intercepted
		// with page.route and fulfilled locally, so it can never return 5xx.
		// The only live reads left are /meta, /version and the OAM's own
		// calls — and /meta fails ~1 read in 10 on this testbed's OAM→gateway
		// hop (measured: 2/20 at HTTP 500, 10.04s each; see the resume doc).
		// openAddDialogWithBody already reloads past the FUNCTIONAL effect;
		// this allows the console line the dropped request leaves behind.
		// The repo deliberately does not allow 5xx globally — do not lift
		// this into fixtures.ts.
		consoleGuard.allow(/Failed to load resource: the server responded with a status of (500|502|504)/);
		await page.goto(`instance/traffic/lb?name=${instName}`);
	});

	test('B-01: a ready gateway offers both KV-exact topologies', async ({page}) => {
		await mockCapabilities(page, {body: capsBody({name: CAP, ready: true})});
		await openAddToTopology(page);

		const names = await topologyOptionNames(page);
		for (const option of EXACT_OPTIONS) expect(names, `offered: ${names.join(' | ')}`).toContain(option);
		// No refusal banner when the gateway said yes.
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toHaveCount(0);
	});

	test('B-02: a not-ready gateway withdraws both, and quotes its own sentence verbatim', async ({page}) => {
		await mockCapabilities(page, {body: capsBody({name: CAP, ready: false, reason: GW_SENTENCE, reason_code: 'KV_EXACT_SEED_UNSET'})});
		await openAddToTopology(page);

		const names = await topologyOptionNames(page);
		for (const option of EXACT_OPTIONS) expect(names, `offered: ${names.join(' | ')}`).not.toContain(option);
		expect(names).toContain('Plain routing');

		// ⚠️ Deliberately brittle IN THE RIGHT DIRECTION: this fails if anyone
		// paraphrases, truncates or re-wraps the gateway's sentence. It names
		// the variable, the bound and the engine setting it must match — the
		// only actionable content — and we cannot restate it without drifting.
		await expect(dialog(page).getByText(GW_SENTENCE, {exact: true})).toBeVisible();
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toBeVisible();
	});

	test('B-03: an older gateway with no capability endpoint still offers them, silently', async ({page, consoleGuard}) => {
		// THE FAIL-OPEN CASE. 404 means "this build predates the surface", not
		// "refused" — withdrawing here would take the feature away from every
		// gateway that has not been upgraded yet, on no evidence at all.
		consoleGuard.allow(/status of 404/i);
		consoleGuard.allow(/Failed to load resource/i);
		await mockCapabilities(page, {status: 404});
		await openAddToTopology(page);

		const names = await topologyOptionNames(page);
		for (const option of EXACT_OPTIONS) expect(names, `offered: ${names.join(' | ')}`).toContain(option);
		// Unknown is not a refusal: no banner, and nothing that reads as an error.
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toHaveCount(0);
		await expect(dialog(page).getByText(/will refuse this rule/)).toHaveCount(0);
	});

	test('B-04: a capability list that does not mention KV-exact is not a refusal', async ({page}) => {
		// not-listed ≠ not-ready. The gateway answered, but this build does not
		// know the capability — same evidential value as no endpoint at all.
		await mockCapabilities(page, {body: capsBody({name: 'some_other_capability', ready: false})});
		await openAddToTopology(page);

		const names = await topologyOptionNames(page);
		for (const option of EXACT_OPTIONS) expect(names, `offered: ${names.join(' | ')}`).toContain(option);
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toHaveCount(0);
	});

	test('B-05: a malformed `ready` is not a refusal', async ({page}) => {
		// `ready` is required upstream, so a missing one is a gateway bug. The
		// form must report a bug by leaving the control alone, not by inventing
		// a refusal the gateway never made.
		await mockCapabilities(page, {body: capsBody({name: CAP, reason: 'no ready field here'})});
		await openAddToTopology(page);

		const names = await topologyOptionNames(page);
		for (const option of EXACT_OPTIONS) expect(names, `offered: ${names.join(' | ')}`).toContain(option);
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toHaveCount(0);
	});

	test('B-06: a non-vllm engine neither consults the capability nor inherits its refusal', async ({page}) => {
		// The capability is ONLY about vllm. sglang has its own admission rules
		// that this surface does not report, so a vllm refusal must not leak
		// across engines — and the request-side contract guard must stop asking.
		const caps = await mockCapabilities(page, {body: capsBody({name: CAP, ready: false, reason: GW_SENTENCE})});
		await openAddToTopology(page);
		// Armed: as vllm, the refusal is in force.
		expect(await topologyOptionNames(page)).not.toContain('Single-role KV exact');
		const asked = caps.count();
		expect(asked, 'the vllm form must have consulted the capability').toBeGreaterThan(0);

		await selectOption(page, 'AI Engine', 'sglang');

		// Both offered again: the vllm verdict does not apply to sglang.
		const names = await topologyOptionNames(page);
		for (const option of EXACT_OPTIONS) expect(names, `offered: ${names.join(' | ')}`).toContain(option);
		await expect(dialog(page).getByText(/KV-exact topologies are not offered/)).toHaveCount(0);
		// And no further reads: the guard is request-side, not filter-side.
		expect(caps.count(), 'a non-vllm engine must not query the vllm capability').toBe(asked);
	});

	test('B-07: ⭐ a withdrawn option that the RULE STANDS ON is still shown, and still reads correctly', async ({page}) => {
		// ⭐⭐ THE ONE TEST AT ANY LEVEL THAT CATCHES THIS.
		//
		// DropDownSelectBox falls back to index 0 when no item matches its
		// value, and it only fires onChange for an EMPTY value. So if the
		// withdrawal dropped an option the form is currently standing on, the
		// control would silently display "Plain routing" while the form still
		// held kvExactMode 3 — the operator would be shown a rule shape that is
		// not the rule, and saving an unrelated field would look like it was
		// preserving what is on screen.
		//
		// The component test pins the option LIST. Only a browser pins what the
		// closed combobox READS.
		const rule = {
			serviceArguments: {
				name: 'e2e-kv-standing', externalIP: '192.0.2.78', port: 18078, protocol: 'tcp',
				sel: 0, mode: 4, inactiveTimeOut: 30, model_name: 'Qwen/Qwen3-32B',
				kvEngineType: 'vllm', kvExactMode: 3, kvBlockSize: 16,
			},
			secondaryIPs: [], allowedSources: [],
			endpoints: [{endpointIP: '198.51.100.78', weight: 1, targetPort: 8000, state: 'active', counter: '0'}],
		};
		await page.route(LB_ALL_RE, (route: Route) => route.fulfill({
			status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: [rule]}),
		}));
		await mockCapabilities(page, {body: capsBody({name: CAP, ready: false, reason: GW_SENTENCE})});

		await page.reload();
		// Same /meta hazard as the Add path, same bounded reload — see
		// openAddDialogWithBody. The row must be reselected after a reload.
		for (let attempt = 1; ; attempt++) {
			await selectRowByText(page, 'e2e-kv-standing');
			try {
				await openToolbarDialog(page, 'Edit', field(page, 'Rule Name'), {timeout: 20_000, attempts: 1});
				break;
			} catch (err) {
				if (attempt >= 5) throw err;
				await dialogButton(page, 'Cancel').click().catch(() => undefined);
				await page.reload();
			}
		}
		await expandSection(page, /^Advanced Settings/);
		await expandSection(page, /^AI Gateway/);

		// 1. What the CONTROL READS — the assertion that matters. The rendered
		//    text is the operator's only evidence of the rule's shape; the
		//    accessible name is just the label ("Topology"), so asserting on
		//    that would pass no matter which option the control had fallen
		//    back to. This is the exact string that would read "Plain routing"
		//    if topologyOptions() stopped honouring `current`.
		await expect(topologyBox(page)).toHaveText('Single-role KV exact');

		// 2. The option it stands on is still in the list, so the operator can
		//    reopen the control without the selection evaporating.
		expect(await topologyOptionNames(page)).toContain('Single-role KV exact');

		// 3. ...and the refusal is still stated, at error severity, because this
		//    rule WILL be refused on save.
		await expect(dialog(page).getByText(GW_SENTENCE, {exact: true})).toBeVisible();
		await expect(dialog(page).getByText(/will refuse this rule/)).toBeVisible();
	});

	test('B-08: readiness is re-read when the form reopens, not frozen for the session', async ({page}) => {
		// The verdict is a property of the gateway's LAUNCH ENVIRONMENT, so it
		// changes exactly when an operator restarts the gateway with the seed —
		// the event they are waiting on. `staleTime: Infinity` would keep
		// telling them it is still unavailable for the rest of the session.
		const caps = await mockCapabilities(page, {body: capsBody({name: CAP, ready: false, reason: GW_SENTENCE})});
		await openAddToTopology(page);
		const first = caps.count();
		expect(first).toBeGreaterThan(0);
		await dialogButton(page, 'Cancel').click();
		await expect(dialog(page)).toHaveCount(0);

		// ⚠️ Load-bearing wait, do not delete: useQueryInstanceData sets
		// staleTime 5000, so a remount inside that window legitimately serves
		// cache and would make this assert nothing. Waiting it out is what
		// makes the test fail on `staleTime: Infinity` and only on that.
		await page.waitForTimeout(6_000);

		await openAddToTopology(page);
		await expect(dialog(page).getByText(GW_SENTENCE, {exact: true})).toBeVisible();
		expect(caps.count(), 'reopening the form must re-ask the gateway').toBeGreaterThan(first);
	});

	//---------------------------------------------------------
	// Gap C — the 412 an operator can still reach
	//---------------------------------------------------------
	// Reachable despite the withdrawal above: the form only withdraws the
	// option when the gateway positively refuses, so a rule built while the
	// verdict was unknown (404, or a gateway restarted after the dialog
	// opened) still submits and is refused on the wire.

	test('C-01: a 412 is reported as a deployment precondition, not as an invalid request', async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of 412/i);
		consoleGuard.allow(/Failed to load resource/i);
		// Unknown readiness, so the form offers the topology and lets the
		// submit reach the gateway — which is what produces the 412.
		await mockCapabilities(page, {status: 404});
		await page.route(LB_POST_RE, (route: Route) => {
			if (route.request().method() !== 'POST') return route.fallback();
			return route.fulfill({status: 412, contentType: 'application/json', body: JSON.stringify({result: GW_SENTENCE})});
		});

		await openAddToTopology(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		const aigw = await expandSection(page, /^AI Gateway/);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		const eps = await expandSection(page, /^Endpoints$/);
		await eps.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', eps).first().fill('198.51.100.79');
		await field(page, 'Target Port', eps).first().fill('8000');

		await dialogButton(page, 'Create').click();

		// THE DISTINCTION IS THE WHOLE POINT. "The request was rejected as
		// invalid" sends the operator back into the form to hunt for a field
		// that is not wrong; the precondition wording tells them the truth —
		// nothing they can type here will change the answer.
		await expect(page.getByText(/its deployment must change/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText('The request was rejected as invalid.')).toHaveCount(0);

		// ⭐ "Its deployment must change" is only half an answer — it does not
		// say WHICH setting, and the UI cannot know. The gateway's own sentence
		// does, and it is the only actionable content in the response, so a 412
		// renders it verbatim after the mapped headline (opResultText.ts). Same
		// deliberate brittleness as B-02: a paraphrase here is a regression.
		await expect(page.getByText(GW_SENTENCE, {exact: false})).toBeVisible();
		// NOT expectErrorAndDismiss: a 412 now leaves the operator's form
		// standing behind the popup (C-02), so that helper's closing
		// "the dialog is hidden" would assert the bug back in.
		await dismissErrorKeepingForm(page);
	});

	test('C-02: ⭐ a 412 does NOT cost the operator the form they filled in', async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of 412/i);
		consoleGuard.allow(/Failed to load resource/i);
		// Same shape as C-01 — and deliberately WITHOUT a model profile. A
		// profile-carrying rule always kept its draft (AC-06); this is the case
		// that did not, and it is the one where losing it is least defensible.
		await mockCapabilities(page, {status: 404});
		await page.route(LB_POST_RE, (route: Route) => {
			if (route.request().method() !== 'POST') return route.fallback();
			return route.fulfill({status: 412, contentType: 'application/json', body: JSON.stringify({result: GW_SENTENCE})});
		});

		await openAddToTopology(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		const aigw = await expandSection(page, /^AI Gateway/);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		const eps = await expandSection(page, /^Endpoints$/);
		await eps.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', eps).first().fill('198.51.100.79');
		await field(page, 'Target Port', eps).first().fill('8000');

		await dialogButton(page, 'Create').click();
		await expect(page.getByText(/its deployment must change/)).toBeVisible({timeout: 20_000});
		await dismissErrorKeepingForm(page);

		// ⭐ THE ASSERTION. The refusal is about the gateway's launch
		// environment; every value below is one the operator had no reason to
		// change, spread over four of the form's six sections. Before the fix
		// the dialog was simply GONE here (`element(s) not found`) and all of
		// it had to be retyped.
		await expect(field(page, 'Rule Name')).toHaveValue('e2e-kv-readiness');

		const basic = await expandSection(page, /^Basic Settings/);
		await expect(field(page, 'External IP', basic)).toHaveValue('192.0.2.77');
		await expect(field(page, 'Port Min', basic)).toHaveValue('18077');

		const aigw2 = await expandSection(page, /^AI Gateway/);
		await expect(field(page, 'Model Name', aigw2)).toHaveValue('Qwen/Qwen3-32B');
		await expect(field(page, 'KV Block Size', aigw2)).toHaveValue('16');
		// ⚠️ Topology is a control OF the AI Gateway section, so it is only
		// queryable once that section is expanded — asserting it earlier finds
		// nothing and reads as a lost value rather than a collapsed panel.
		// ⚠️ And its ACCESSIBLE NAME is only the label; the selected value lives
		// in its TEXT. Asserting on the name would pass against whatever option
		// the control fell back to — the silent misreport B-07 exists to catch.
		await expect(topologyBox(page)).toHaveText(/Single-role KV exact/);

		const eps2 = await expandSection(page, /^Endpoints$/);
		await expect(field(page, 'IP', eps2).first()).toHaveValue('198.51.100.79');
		await expect(field(page, 'Target Port', eps2).first()).toHaveValue('8000');
	});

	test('C-03: an INVALID create still clears the form — the 412 carve-out is not a blanket change', async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of 400/i);
		consoleGuard.allow(/Failed to load resource/i);
		// The other half of the decision, and the half a careless "preserve on
		// any failure" would erase. A 400 IS about what was typed, so the
		// existing behaviour must be untouched by the precondition carve-out.
		await mockCapabilities(page, {status: 404});
		await page.route(LB_POST_RE, (route: Route) => {
			if (route.request().method() !== 'POST') return route.fallback();
			return route.fulfill({status: 400, contentType: 'application/json', body: JSON.stringify({result: 'Malformed arguments for API call'})});
		});

		await openAddToTopology(page);
		await selectOption(page, 'Topology', 'Single-role KV exact');
		const aigw = await expandSection(page, /^AI Gateway/);
		await setField(page, 'KV Block Size', '16', aigw);
		await field(page, 'Block/Page Size Confirmed', aigw).check();

		const eps = await expandSection(page, /^Endpoints$/);
		await eps.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', eps).first().fill('198.51.100.79');
		await field(page, 'Target Port', eps).first().fill('8000');

		await dialogButton(page, 'Create').click();
		await expectErrorAndDismiss(page);
		// No reopened form: a 400 sends the operator back to the list, as it
		// always has. If this ever goes red, the carve-out widened.
		await expect(dialog(page).getByLabel('Rule Name')).toHaveCount(0);
	});
});
