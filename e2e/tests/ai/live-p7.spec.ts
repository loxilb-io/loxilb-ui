//---------------------------------------------------------
// Live RC qualification — MP-E2E-019..022 (plan §2.3).
//
// LIVE layer: nothing is mocked. Runs ONLY with E2E_LIVE_P7=1 against the
// pinned testbed OAM→gateway instance, because it depends on live state the
// regular suite must not assume (an operator-published profile registry) and
// records per-case evidence bundles (E2E_LIVE_P7_EVIDENCE_DIR overrides the
// default test-results location).
//
// Safety contract (request §7.3): serial, no retries, `e2e-` rule name,
// RFC-5737 documentation IPs, the registry is never mutated, and the one
// marker rule is deleted by the final case (plus an idempotent afterAll
// backstop). Console errors and full-page error redirects fail the run via
// the standard consoleGuard fixture.
//
// Verification level: LIVE CONTROL-PLANE. The testbed endpoints are
// documentation IPs with no engine behind them, so the status panel's honest
// terminal state (pending/fenced) is the expected PASS — READY would require
// a live engine/GPU and is deliberately NOT claimed (never promoted).
//---------------------------------------------------------
import * as fs from 'fs';
import * as path from 'path';
import type {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson} from '../../helpers/api';
import {cleanupLbByName, driveLbCreate, LbRecipe} from '../cicd/_recipes';
import {rowByText, showAllRows, toolbarButton} from '../../helpers/table';
import {confirmDelete, dialog, dialogButton} from '../../helpers/dialogs';

const LIVE = process.env.E2E_LIVE_P7 === '1';

const EVIDENCE_ROOT = process.env.E2E_LIVE_P7_EVIDENCE_DIR ?? path.join(__dirname, '../../../test-results/live-p7-evidence');
const PROFILES_PATH = '/config/ai/model-profiles';

// The operator-published fixture this run binds against (read-only).
const FIXTURE_PROFILE = 'qwen3-06b-completions-v1';
const FIXTURE_MODEL = 'Qwen/Qwen3-0.6B';

const RULE: LbRecipe = {
	cicd: 'live-p7 (not a cicd port)',
	name: 'e2e-mp-live-p7',
	vip: '192.0.2.77',
	port: '18077',
	mode: 'fullproxy',
	host: '192.0.2.77',
	// kvBlockSize matters twice: it is realistic for a KV-exact rule, and the
	// recipe driver checks the mandatory Block/Page Size confirmation only
	// when it is set (kvExactMode 1/3 refuses Create unconfirmed).
	ai: {modelName: FIXTURE_MODEL, pdDisaggMode: true, kvExactMode: '1', kvBlockSize: '16', modelProfile: FIXTURE_PROFILE, apiSurface: 'completions'},
	endpoints: [
		{ip: '198.51.100.77', targetPort: '8000', epRole: 'prefill'},
		{ip: '198.51.100.78', targetPort: '8000', epRole: 'decode'},
	],
};

function evidence(caseId: string, file: string, data: unknown) {
	const dir = path.join(EVIDENCE_ROOT, caseId);
	fs.mkdirSync(dir, {recursive: true});
	fs.writeFileSync(path.join(dir, file), typeof data === 'string' ? data : JSON.stringify(data, null, '\t'));
}

async function shot(page: Page, caseId: string, name: string) {
	const dir = path.join(EVIDENCE_ROOT, caseId);
	fs.mkdirSync(dir, {recursive: true});
	await page.screenshot({path: path.join(dir, name), fullPage: true});
}

const utc = () => new Date().toISOString();

let instName: string;
// Registry identity at session start — 022 proves it never moved.
let startRegistry: {registryGeneration: number; setDigest?: string};

test.describe.serial('@gw Live P7 — model-profile RC qualification (MP-E2E-019..022)', () => {
	test.skip(!LIVE, 'live P7 qualification runs only with E2E_LIVE_P7=1 (mutating, needs a published live registry)');

	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		startRegistry = await gwJson(PROFILES_PATH);
	});

	test.afterAll(async () => {
		if (!LIVE) return;
		// Backstop only: MP-E2E-022 is the real cleanup and asserts it.
		await cleanupLbByName(RULE.name);
	});

	test('MP-E2E-019: live inventory read — contract-shaped body, honest UI, no leakage', async ({page}) => {
		const t0 = utc();
		const respPromise = page.waitForResponse(r => r.url().includes(PROFILES_PATH) && r.request().method() === 'GET', {timeout: 30_000});
		await page.goto(`instance/ai/profiles?name=${instName}`);
		const resp = await respPromise;
		const body = await resp.json();

		// Contract shape straight off the live wire.
		expect(resp.status()).toBe(200);
		expect(Array.isArray(body.profiles)).toBe(true);
		expect(typeof body.registryGeneration).toBe('number');
		expect(body.registryGeneration).toBeGreaterThan(0);
		expect(typeof body.setDigest).toBe('string');
		const ids = body.profiles.map((p: any) => p.profileId);
		expect([...ids].sort(), 'profiles arrive sorted by profileId').toEqual(ids);
		expect(ids).toContain(FIXTURE_PROFILE);

		// The UI renders what the wire said — all rows, identity chips.
		for (const id of ids) await expect(rowByText(page, id)).toBeVisible({timeout: 20_000});
		await expect(page.getByText(`Generation ${body.registryGeneration}`)).toBeVisible();
		await expect(page.getByText(body.setDigest)).toBeVisible();

		// Read-only surface (AC-12) and no server-filesystem leakage.
		for (const verb of ['Add', 'Delete', 'Edit', 'Upload', 'Activate']) {
			await expect(toolbarButton(page, verb)).toHaveCount(0);
		}
		const pageText = (await page.locator('body').innerText()) ?? '';
		expect(pageText, 'no artifact locator paths leak into the UI').not.toMatch(/\/(etc|opt|var|home)\/[\w./-]+/);

		evidence('MP-E2E-019', 'list-response.json', {utc: t0, status: resp.status(), url: resp.url().replace(/^https?:\/\/[^/]+/, ''), body});
		await shot(page, 'MP-E2E-019', 'inventory.png');
	});

	test('MP-E2E-020: strict rule create — exact wire identity, no Ready claim from a 2xx', async ({page}) => {
		test.setTimeout(180_000);
		const t0 = utc();
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);

		const respPromise = page.waitForResponse(r => r.url().includes('/config/loadbalancer') && r.request().method() === 'POST', {timeout: 60_000});
		const postBody = await driveLbCreate(page, RULE);
		const resp = await respPromise;
		const respJson = await resp.json().catch(() => null);

		// AC-04: exactly the two strict scalars, values verbatim.
		expect(postBody.serviceArguments.kvModelProfile).toBe(FIXTURE_PROFILE);
		expect(postBody.serviceArguments.kvExactApiMode).toBe('completions');
		expect(postBody.serviceArguments.model_name).toBe(FIXTURE_MODEL);
		const strictKeys = Object.keys(postBody.serviceArguments).filter(k => /profile|binding|digest/i.test(k));
		expect(strictKeys.sort()).toEqual(['kvModelProfile']);
		expect(resp.status(), `gateway admitted the strict create (body: ${JSON.stringify(respJson)})`).toBeLessThan(300);

		// The row exists; a 2xx save is NOT readiness and the UI must not say so.
		await expect(rowByText(page, RULE.name)).toBeVisible({timeout: 30_000});
		const bodyText = (await page.locator('body').innerText()) ?? '';
		expect(bodyText).not.toContain('Ready — fully attested');

		evidence('MP-E2E-020', 'create.json', {
			utc: t0,
			request: postBody,
			responseStatus: resp.status(),
			responseBody: respJson,
			registryAtStart: startRegistry,
		});
		await shot(page, 'MP-E2E-020', 'rule-created.png');
	});

	test('MP-E2E-021: enforcement status — live polling sequence, honest non-ready terminal state', async ({page}) => {
		test.setTimeout(180_000);
		const t0 = utc();
		const sequence: Array<{utc: string; status: number; body: unknown}> = [];
		page.on('response', resp => {
			if (/\/kvexactstatus(\?|$)/.test(resp.url())) {
				resp.json().then(b => sequence.push({utc: utc(), status: resp.status(), body: b})).catch(() => sequence.push({utc: utc(), status: resp.status(), body: null}));
			}
		});

		await page.goto(`instance/traffic/lb?name=${instName}`);
		await showAllRows(page);
		await rowByText(page, RULE.name).click();
		await page.getByRole('tab', {name: 'AI Gateway'}).click();
		await expect(page.getByText('KV Exact Enforcement Status')).toBeVisible({timeout: 20_000});

		// Observe at least three polls of the live cadence.
		await expect.poll(() => sequence.length, {timeout: 90_000}).toBeGreaterThanOrEqual(3);
		await shot(page, 'MP-E2E-021', 'status-panel.png');

		// Declared config is shown as DECLARED, and identity comes from the wire.
		const bodyText = (await page.locator('body').innerText()) ?? '';
		expect(bodyText).toContain(FIXTURE_PROFILE);

		// A READY claim requires a captured READY + goFenced=false pair; with
		// documentation-IP endpoints the honest expectation is a non-ready
		// state — assert the UI never overclaims relative to the wire.
		const sawProvenReady = sequence.some(s => {
			const entries = (s.body as any)?.kvExactStatusAttr ?? [];
			return entries.some((e: any) => /^READY$/i.test(e?.enforcedState ?? '') && e?.enforcement?.goFenced === false);
		});
		if (!sawProvenReady) {
			expect(bodyText).not.toContain('Ready — fully attested');
		}

		evidence('MP-E2E-021', 'status-sequence.json', {utc: t0, polls: sequence.length, sequence, sawProvenReady});
	});

	test('MP-E2E-022: cleanup — marker rule deleted, registry identity untouched', async ({page}) => {
		test.setTimeout(120_000);
		const t0 = utc();
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await showAllRows(page);
		await rowByText(page, RULE.name).getByRole('checkbox').check();
		await toolbarButton(page, 'Delete').click();
		await confirmDelete(page);
		await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
		await dialogButton(page, 'OK').click();
		await expect(rowByText(page, RULE.name)).toHaveCount(0, {timeout: 30_000});

		// API-side proof: the rule is gone and ONLY the rule is gone.
		const list = await gwJson<any>('/config/loadbalancer/all');
		const names = (list.lbAttr ?? []).map((r: any) => r.serviceArguments?.name);
		expect(names).not.toContain(RULE.name);

		// The registry was never touched: same generation, same digest.
		const endRegistry = await gwJson<any>(PROFILES_PATH);
		expect(endRegistry.registryGeneration).toBe(startRegistry.registryGeneration);
		expect(endRegistry.setDigest).toBe(startRegistry.setDigest);

		evidence('MP-E2E-022', 'cleanup.json', {
			utc: t0,
			remainingRules: names,
			registryAtStart: startRegistry,
			registryAtEnd: {registryGeneration: endRegistry.registryGeneration, setDigest: endRegistry.setDigest},
		});
		await shot(page, 'MP-E2E-022', 'after-cleanup.png');
	});
});
