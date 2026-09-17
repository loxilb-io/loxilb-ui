//---------------------------------------------------------
// AI Gateway — JWT auth profiles (J1) + rule integration (J2).
//
// Render and client-validation tests always run. Live mutation tests run only
// when the readiness probe proves the gateway actually implements the bearer
// auth contract; 401/403/503 are distinct skip reasons, and 404/501 mean the
// gateway predates the feature rather than that the UI is broken.
//
// Adversarial focus — every live assertion below corresponds to something a
// manual session on a real gateway proved the UI can get wrong:
//
//   J-E2E-1  untouched optionals must go on the wire ABSENT, never as 0 or "".
//            Zero is never meaningful on this entry: it selects the default,
//            so a form that materializes one pins a value nobody chose.
//   J-E2E-2  POST is create-OR-REPLACE and there is NO PATCH, so a save that
//            changes nothing must come back byte-identical. Anything the edit
//            loader drops is silently reverted on every save.
//   J-E2E-3  the live gateway answers "algs": null (a nil Go slice) for a
//            profile pinning no algorithms, even though the vendored contract
//            declares `algs?: string[]` and never nullable. Code that guards
//            with `!== undefined` throws on it.
//   J-E2E-4  the delete refusal must NAME the blocking rule. An LB rule's name
//            is frequently empty — a live gateway carried four unnamed rules
//            out of five — so the message has to fall back to VIP:port, which
//            is also the vocabulary the gateway's own 409 uses.
//   J-E2E-5  a rule carrying a credential policy is fullproxy, and a fullproxy
//            rule CANNOT be edited in place. So "detach the profile" is not a
//            thing an operator can do, and the refusal must not advise it.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {
	activeInstance,
	AIManagementReadiness,
	E2E_PREFIX,
	gatewayExportsJwksGauges,
	gatewayJwtAuthReadiness,
	gw,
	JWTPROFILE_PATH,
	listJwtAuthProfiles,
	sweepJwtAuthProfiles,
	sweepLbRules,
} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {grid, refreshUntilRow, rowByText, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const LB_PATH = '/config/loadbalancer';
// 8080 is claimed by the co-hosted OAM and rejected by the gateway's
// OAM_RESERVED_ENDPOINTS guard — the same trap traffic/lb.spec.ts documents.
// A collision here would look like a JWT failure and is not one.
const LB_PORT = 18443;
const PROFILE = 'e2e-jwt-realm';
const ISSUER = 'https://idp.example.com/realms/e2e';

let instName: string;
let readiness: AIManagementReadiness;

/** Seeds a fullproxy rule bound to `PROFILE` over the API. */
async function apiCreateBoundRule(args: {name: string; externalIP: string}): Promise<void> {
	const resp = await gw('POST', LB_PATH, {
		serviceArguments: {
			name: args.name, externalIP: args.externalIP, port: LB_PORT, protocol: 'tcp',
			sel: 0, mode: 4, // fullproxy — the only mode that accepts a credential policy
			api_key_auth: 'jwt', jwt_auth_profile: PROFILE,
		},
		endpoints: [{endpointIP: '203.0.113.60', targetPort: LB_PORT, weight: 1}],
	});
	expect(resp.status, `API seed bound rule ${args.name || '(unnamed)'}`).toBeLessThan(300);
}

/**
 * Select a row and wait for the toolbar to register it.
 *
 * ⚠️ Checking the box is not enough to click Edit. A refetch landing right
 * after a mutation re-renders the grid and clears `selected_rows`, so the
 * Edit button can still be disabled the instant after the check succeeds.
 * Waiting on the BUTTON rather than the checkbox is what makes this stable.
 */
async function selectRowForEdit(page: Page, text: string): Promise<void> {
	await expect(async () => {
		await selectRowByText(page, text);
		await expect(toolbarButton(page, 'Edit')).toBeEnabled({timeout: 2_000});
	}).toPass({timeout: 20_000});
}

async function apiCreateProfile(): Promise<void> {
	const resp = await gw('POST', JWTPROFILE_PATH, {name: PROFILE, issuer: ISSUER});
	expect(resp.status, 'API seed profile').toBeLessThan(300);
}

test.describe('@gw AI JWT auth profiles', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		readiness = await gatewayJwtAuthReadiness();
		// Rules first: a profile referenced by a rule is refused with 409.
		await sweepLbRules();
		await sweepJwtAuthProfiles();
	});

	test.afterEach(async () => {
		await sweepLbRules();
		await sweepJwtAuthProfiles();
	});

	test.beforeEach(async ({page, consoleGuard}) => {
		consoleGuard.allow(/status of (401|403|404|501|503)/i);
		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/jwtauth?name=${instName}`);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	});

	//---------------------------------------------------------
	// Render — no gateway state required
	//---------------------------------------------------------
	test('render: the page states what the list is, and is not, without white-screening', async ({page}) => {
		await expect(grid(page)).toBeVisible();
		await expect(toolbarButton(page, 'Add')).toBeEnabled();

		// The list is desired CONFIGURATION. Claiming it reflects issuer health
		// would be a lie: a profile can list here and still fail closed on the
		// data plane, which is what the loxilb_ai_jwks_* families answer.
		//
		// ⚠️ Since J3 the notice is CONDITIONAL and both branches are correct —
		// which is exactly why this asserts the invariant rather than either
		// wording. Where keyset health IS reported, repeating "does not report
		// whether an issuer is reachable" would send an operator looking for
		// information already on screen; where it is NOT, dropping the
		// disclaimer would leave the table looking like a health view.
		const disclaims = page.getByText(/does not report whether an issuer is reachable/i);
		const defers = page.getByText(/reported under Keyset health below/i);
		expect(await disclaims.count() + await defers.count(), 'exactly one issuer-health notice').toBe(1);
		await expect((await defers.count()) > 0 ? defers : disclaims).toBeVisible();

		// A 402/401 answers a JSON object rather than an array; mapping that as a
		// list would throw and white-screen the page.
		await expect(page.locator('body')).not.toContainText(/is not a function|Cannot read properties/i);
	});

	//---------------------------------------------------------
	// Client validation — no gateway state required
	//---------------------------------------------------------
	test('client validation: identity, URL scheme, the 63-BYTE cap, and a refused numeric', async ({page}) => {
		await openToolbarDialog(page, 'Add', dialogTitle(page, 'New JWT Auth Profile'));
		const add = dialogButton(page, 'Add');

		// name + issuer are both required.
		await expect(add).toBeDisabled();
		await field(page, 'Name').fill(PROFILE);
		await expect(add).toBeDisabled();
		await field(page, 'Issuer').fill(ISSUER);
		await expect(add).toBeEnabled();

		// The issuer doubles as the OIDC discovery base, so it must be http(s).
		// A javascript: scheme surviving here would be stored XSS, since these
		// values are rendered back to the operator.
		await field(page, 'Issuer').fill('idp.example.com');
		await expect(add).toBeDisabled();
		await field(page, 'Issuer').fill(ISSUER);
		await expect(add).toBeEnabled();

		// ⚠️ The cap is 63 BYTES, not characters, because the LB rule's reference
		// field is 63 bytes — the gateway refuses a longer name at CREATE so that
		// a profile no rule could ever reference cannot exist. 21 three-byte
		// characters is exactly 63; 22 is 66. A character-count check accepts both.
		await field(page, 'Name').fill('한'.repeat(21));
		await expect(add, '21 × 3-byte characters = 63 bytes, the cap exactly').toBeEnabled();
		await field(page, 'Name').fill('한'.repeat(22));
		await expect(add, '22 × 3-byte characters = 66 bytes, over the cap').toBeDisabled();
		await field(page, 'Name').fill(PROFILE);
		await expect(add).toBeEnabled();

		// A half-typed number must block submit AND say why. Painting the field
		// red while the helper text still reads as an ordinary hint tells the
		// operator something is wrong but never what.
		await field(page, 'Clock skew (s)').fill('3o');
		await expect(add).toBeDisabled();
		await expect(dialog(page).getByText(/whole number/i), 'the refusal must name its reason, not just turn red').toBeVisible();
		await field(page, 'Clock skew (s)').fill('45');
		await expect(add).toBeEnabled();

		// Empty audiences is a REAL setting — it skips the audience check — so it
		// must be stated rather than left to be discovered in production.
		await expect(dialog(page).getByText(/audience check is skipped/i)).toBeVisible();

		await dialogButton(page, 'Cancel').click();
	});

	//---------------------------------------------------------
	// Live: create / replace round-trip
	//---------------------------------------------------------
	test('J-E2E-1/2/3: create omits untouched optionals, and a no-op save changes nothing', async ({page}) => {
		expect(readiness.status, 'JWT auth route must not answer a retired capability gate').not.toBe(501);
		test.skip(!readiness.ready, readiness.reason);

		await openToolbarDialog(page, 'Add', dialogTitle(page, 'New JWT Auth Profile'));
		await field(page, 'Name').fill(PROFILE);
		await field(page, 'Issuer').fill(ISSUER);
		await field(page, 'Audiences').fill('api://gateway, account');
		await field(page, 'Clock skew (s)').fill('45');
		await page.mouse.move(0, 0);

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(JWTPROFILE_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect((await req.response())?.status()).toBeLessThan(300);

		// J-E2E-1: what the operator typed, and nothing else.
		expect(body).toMatchObject({name: PROFILE, issuer: ISSUER, leeway_sec: 45});
		expect(body.audiences, 'a comma list splits and trims').toEqual(['api://gateway', 'account']);
		// Every untouched optional is ABSENT. A literal 0 or "" here would pin a
		// value the operator never chose and stop tracking the gateway default.
		for (const f of ['jwks_url', 'refresh_sec', 'tenant_claim', 'user_claim', 'models_claim', 'roles_claim', 'model_role_prefix', 'username_claim', 'default_tenant']) {
			expect(body, `${f} must be absent on an untouched form`).not.toHaveProperty(f);
		}
		// The form's own validity flag is never part of the payload.
		expect(body.isValid).toBeUndefined();
		await expectSuccessAndDismiss(page);

		// J-E2E-3: the gateway answers algs: null for a profile pinning none.
		// Rendering must survive it — the vendored type says it cannot happen.
		const [stored] = (await listJwtAuthProfiles()).filter(p => p.name === PROFILE);
		expect(stored, 'the profile is readable back').toBeTruthy();
		await toolbarButton(page, 'Refresh').click();
		await expect(rowByText(page, PROFILE).first()).toBeVisible({timeout: 10_000});

		// J-E2E-2: reopen and save WITHOUT touching anything. POST is
		// create-or-replace with no PATCH, so a partial send silently reverts
		// every field it omits.
		await selectRowForEdit(page, PROFILE);
		await openToolbarDialog(page, 'Edit', dialogTitle(page, 'Edit JWT Auth Profile'));
		// The heading must not say "New" while editing an existing profile.
		await expect(dialog(page).getByText(/replaces the whole profile/i), 'replace semantics are stated up front').toBeVisible();
		await page.mouse.move(0, 0);
		const [saveReq] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(JWTPROFILE_PATH)),
			dialogButton(page, 'Save').click(),
		]);
		expect((await saveReq.response())?.status()).toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		const [after] = (await listJwtAuthProfiles()).filter(p => p.name === PROFILE);
		expect(after, 'a no-op replace must not lose a single field').toEqual(stored);
	});

	//---------------------------------------------------------
	// Live: J2 rule integration
	//---------------------------------------------------------
	test('J2: the profile selector appears only where the mode consults it, and both fields travel together', async ({page}) => {
		test.skip(!readiness.ready, readiness.reason);
		await apiCreateProfile();

		await page.goto(`instance/traffic/lb?name=${instName}`);
		await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');

		async function expand(title: RegExp): Promise<void> {
			const sec = dialog(page).locator('.MuiAccordion-root').filter({has: page.locator('h6', {hasText: title})});
			const summary = sec.locator('.MuiAccordionSummary-root').first();
			if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
		}

		await expand(/^AI Gateway/);
		const policy = dialog(page).getByLabel(/Data-plane Credential Policy/);

		// ⚠️ A credential policy is meaningful only on an L7 rule, and the form
		// gates the control on it: the default mode is dnat, so the policy starts
		// DISABLED. Without this the rest of the test clicks a disabled combobox
		// — and more importantly, a regression that let an operator declare a JWT
		// policy on a dnat rule would ship a rule the gateway refuses.
		await expect(policy, 'the policy is unreachable until the rule is fullproxy').toBeDisabled();

		await expand(/^Advanced Settings/);
		await selectOption(page, 'Mode', 'fullproxy');
		await expand(/^AI Gateway/);
		await expect(policy, 'fullproxy unlocks the credential policy').toBeEnabled();

		// All four declarable policies plus the omit option. The two JWT modes
		// arrived with the bearer contract; offering only the old pair would make
		// the whole feature unreachable from the rule side.
		await policy.click();
		for (const opt of ['Unmanaged (no policy)', 'Disabled (strip header)', 'Required (enforce and strip)', 'JWT bearer token', 'API key or JWT']) {
			await expect(page.getByRole('option', {name: opt})).toBeVisible();
		}
		await page.getByRole('option', {name: 'Required (enforce and strip)'}).click();

		// A mode that cannot consult a profile must not offer one: a dangling
		// reference is refused (ErrJwtProfileNotApplicable) and would block that
		// profile's deletion for a rule that never reads it.
		await expect(dialog(page).getByLabel(/JWT Auth Profile/)).toHaveCount(0);

		await selectOption(page, 'Data-plane Credential Policy', 'JWT bearer token');
		await expect(dialog(page).getByLabel(/JWT Auth Profile/)).toBeVisible();
		// Until one is picked the rule is invalid, and the form says so rather
		// than deferring it to a 400 on save.
		await expect(dialog(page).getByText(/JWT mode requires a profile/i)).toBeVisible();

		// A selector, never free text — the gateway rejects an unconfigured name,
		// and a dropdown makes that state unreachable.
		await selectOption(page, 'JWT Auth Profile', PROFILE);
		await expect(dialog(page).getByText(/JWT mode requires a profile/i)).toHaveCount(0);

		await selectOption(page, 'Data-plane Credential Policy', 'API key or JWT');
		// "API key or JWT" reads as "try both" and is not: a present X-Api-Key
		// decides ALONE and its rejection is final. An operator who assumes a
		// fallback ships a rule that refuses traffic they meant to admit.
		await expect(dialog(page).getByText(/no JWT fallback/i)).toBeVisible();
	});

	//---------------------------------------------------------
	// Live: the delete refusal
	//---------------------------------------------------------
	test('J-E2E-4/5: a referenced profile is refused, naming an UNNAMED rule by VIP:port', async ({page}) => {
		test.skip(!readiness.ready, readiness.reason);
		await apiCreateProfile();
		// ⚠️ Deliberately NAMELESS. A live gateway carried four unnamed rules out
		// of five, and a refusal built from the rule name alone renders
		// "referenced by 1 LB rule(s): ." — an identifier that names nothing.
		await apiCreateBoundRule({name: '', externalIP: '203.0.113.61'});

		// ⚠️ Deliberately NO page.reload(). This page was painted before either
		// object existed, which is precisely the operator's situation when a rule
		// is attached from another console — and it is the only arrangement that
		// actually TESTS Refresh. A reload refetches everything as a side effect
		// of remounting, so it would hide a Refresh button that refreshes half
		// the page, which is the defect this test exists to catch.
		await showAllRows(page);
		await refreshUntilRow(page, PROFILE);

		// The table itself attributes the reference before anyone tries to delete.
		//
		// ⚠️ Refresh, don't just look. The gateway's LB list is EVENTUALLY
		// CONSISTENT — sweepLbRules() documents the same lag on the delete side —
		// so the read that paints this page can legitimately miss a rule created
		// moments earlier, and the column then says "None". That made this
		// assertion fail roughly one run in three.
		//
		// Clicking Refresh is what converges it, so this also pins the fix it
		// exposed: the page refetches the RULE list too, not just the profiles.
		// With Refresh wired to the profile query alone a stale "None" is
		// permanent — no operator action can correct the one column they use to
		// predict whether a delete will be refused — and this loop then fails.
		await expect(async () => {
			await toolbarButton(page, 'Refresh').click();
			await expect(rowByText(page, PROFILE).first()).toContainText(`203.0.113.61:${LB_PORT}`, {timeout: 3_000});
		}).toPass({timeout: 30_000});

		await selectRowByText(page, PROFILE);
		await openToolbarDialog(page, 'Delete', dialogTitle(page, 'WARNING!! Delete Item'));

		// The pre-check answers from data already on screen, so no request is sent.
		let deleteAttempted = false;
		page.on('request', r => {
			if (r.method() === 'DELETE' && r.url().includes(JWTPROFILE_PATH)) deleteAttempted = true;
		});
		await dialogButton(page, 'Delete').click();

		const err = dialog(page);
		await expect(err).toContainText(PROFILE);
		// VIP:port is the gateway's OWN vocabulary — its 409 reads
		// "referenced by rule(s): 203.0.113.61:18443" — so the pre-check and the
		// server point at the same rule the same way.
		await expect(err, 'an unnamed rule is still identified').toContainText(`203.0.113.61:${LB_PORT}`);
		// J-E2E-5: a fullproxy rule cannot be edited in place, so "detach it"
		// names a control the product does not offer.
		await expect(err, 'the advice must be one the UI can actually carry out').not.toContainText(/detach/i);
		expect(deleteAttempted, 'the pre-check answers locally; no doomed request is sent').toBe(false);
		await dialogButton(page, 'OK').click();
	});

	//---------------------------------------------------------
	// J3 — keyset health
	//---------------------------------------------------------
	test('J3: an unreachable issuer reads as a 503 outage, not as missing data', async ({page}) => {
		test.skip(!readiness.ready, readiness.reason);

		// ISSUER is a documentation domain the testbed cannot resolve, so the
		// verdict is DETERMINISTIC rather than timing-dependent: usable=0 from
		// the first scrape, and no last-success series will ever appear. That
		// is precisely the "never fetched ⇒ 503" arm, the one of the two JWKS
		// outage answers that IS a failure.
		await apiCreateProfile();

		// Probed with the profile in place: the gauges come from a scrape-time
		// collector over live profile state, so an empty gateway exports none
		// of them regardless of its build.
		test.skip(!(await gatewayExportsJwksGauges()), 'Gateway predates the loxilb_ai_jwks_* keyset gauges');

		// Refresh, not reload — the page must converge on its own controls.
		// The snapshot arrives on the shared metrics cadence, so the first
		// press can legitimately precede it.
		await refreshUntilRow(page, PROFILE);
		const health = page.getByText(/Failing closed — never fetched/);
		await expect(health).toBeVisible({timeout: 40_000});

		// Absent, never zero: upstream omits the timestamp series before the
		// first success precisely so nothing reads it as a 1970 date.
		await expect(page.getByText(/^Never$/)).toBeVisible();

		// ⭐ And the panel must not have replaced the honest disclaimer with
		// silence: with health on screen the notice defers to it.
		await expect(page.getByText(/reported under Keyset health below/i)).toBeVisible();

		// A second profile whose name sits exactly on the 63-BYTE cap. Two
		// things ride on it: the panel must join a maximum-length name to its
		// metric label (the gateway truncates labels at 64 bytes, so the cap
		// is one byte below the boundary and the join must not be affected),
		// and the page must stay laid out with the longest legal name on
		// screen.
		const wide = `${E2E_PREFIX}${'w'.repeat(63 - E2E_PREFIX.length)}`;
		expect(wide.length, 'name must sit exactly on the cap').toBe(63);
		const seeded = await gw('POST', JWTPROFILE_PATH, {name: wide, issuer: ISSUER});
		expect(seeded.status, 'API seed wide-name profile').toBeLessThan(300);

		// ⚠️ Seed and refresh at the default width FIRST. At 375px the docked
		// navigation drawer overlays the toolbar, so the Refresh button cannot
		// be clicked — a harness constraint, not a product defect. Only the
		// measurement needs the narrow viewport.
		await refreshUntilRow(page, wide);
		await page.setViewportSize({width: 375, height: 812});
		// The health table renders it as a cell; the profiles DataTable renders
		// it as text. Targeting the cell asserts the PANEL picked the profile
		// up, not merely that the grid did.
		await expect(page.getByRole('cell', {name: wide})).toBeVisible({timeout: 40_000});
		const overflow = await page.evaluate(() => ({
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: document.documentElement.clientWidth,
		}));
		// ⚠️ Honest scope: this is a page-level INVARIANT guard, in the shape
		// the observability responsive gate uses. It was checked against the
		// panel with and without its internal overflow container and passes
		// either way — the page layout already bounds the width here — so it
		// does NOT prove that container is load-bearing. It guards against a
		// future change (a minWidth, an added column, an unwrapped issuer URL)
		// that would widen the document itself.
		expect(overflow.scrollWidth, 'document body must not scroll horizontally').toBeLessThanOrEqual(overflow.clientWidth + 1);
	});

	test('the gateway itself refuses with 409 — the contract the UI race branch depends on', async () => {
		test.skip(!readiness.ready, readiness.reason);
		await apiCreateProfile();
		await apiCreateBoundRule({name: 'e2e-jwt-bound', externalIP: '203.0.113.62'});

		// The UI's pre-check can always be raced by a rule created after its read,
		// so the 409 branch is reachable in production. Pin the status it keys on.
		const resp = await gw('DELETE', `${JWTPROFILE_PATH}/${encodeURIComponent(PROFILE)}`);
		expect(resp.status, 'a referenced profile is refused with 409').toBe(409);
		const text = await resp.text();
		expect(text, 'the refusal identifies the blocking rule').toContain('203.0.113.62');

		// And it becomes deletable once the rule is gone — proving the refusal was
		// the reference and not a permanently undeletable profile.
		await sweepLbRules();
		const after = await gw('DELETE', `${JWTPROFILE_PATH}/${encodeURIComponent(PROFILE)}`);
		expect(after.status, 'unreferenced, the same profile deletes').toBeLessThan(300);
	});

	test('delete succeeds once nothing references the profile', async ({page}) => {
		test.skip(!readiness.ready, readiness.reason);
		await apiCreateProfile();

		await page.reload();
		await showAllRows(page);
		await refreshUntilRow(page, PROFILE);
		await expect(rowByText(page, PROFILE).first()).toContainText(/None/i);

		await selectRowByText(page, PROFILE);
		await openToolbarDialog(page, 'Delete', dialogTitle(page, 'WARNING!! Delete Item'));
		await confirmDelete(page);
		expect((await listJwtAuthProfiles()).some(p => p.name === PROFILE), 'the profile is gone from the gateway').toBe(false);
	});
});
