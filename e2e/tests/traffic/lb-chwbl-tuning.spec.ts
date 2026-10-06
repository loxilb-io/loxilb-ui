//---------------------------------------------------------
// LB rule form — CHWBL ring tuning (mean load factor, replication, required
// cache_salt), gateway only.
//
// The three fields exist only on a fullproxy rule under the chwbl selector.
// The gateway resolves an omitted one itself (175 / 256 / off) and refuses a
// rule that carries any of them anywhere else — an explicit false included,
// because it tracks presence, not value. So the form has to send only what the
// operator set, drop everything once the selector moves away, and the detail
// has to show what the gateway resolved.
//
// What each case would catch:
// - an input that announces a default into the POST;
// - a detail that hides the resolved ring on a rule with no other AI setting;
// - a value typed under chwbl travelling to another selector (gateway 400);
// - an out-of-range value reaching the gateway instead of stopping in the form;
// - a salt requirement switched on without the client-contract warning;
// - a control surviving on a gateway whose /meta does not declare its field.
//
// Live against the gateway; only the last case stubs one endpoint (/meta).
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {detailCaption, detailValue} from '../../helpers/detail';
import {dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const LB_PATH = '/config/loadbalancer';
const META_RE = /\/netlox\/v1\/meta(\?.*)?$/;
const BASIC = /^Basic Settings/;
const ADVANCED = /^Advanced Settings/;
const AIGW = /^AI Gateway/;
const ENDPOINTS = /^Endpoints$/;

const LOAD_FACTOR = 'CHWBL Mean Load Factor (%)';
const REPLICATION = 'CHWBL Replication';
const SALT = 'Require cache_salt';
const TUNING = ['chwbl_mean_load_factor', 'chwbl_replication', 'chwbl_enable_cache_salt'] as const;
const SALT_WARNING = /Every request to this rule needs a cache_salt/;

let instName: string;
let declared: boolean;

/** Whether this gateway's own /meta declares all three tuning fields on the LB create body. */
async function gatewayDeclaresTuning(): Promise<boolean> {
	// /meta is a large document; over a slow hop the OAM proxy can cut it at its
	// own deadline. That is the transport, not the answer, so the read is
	// repeated rather than letting it decide what this suite runs.
	let meta: Record<string, any> | undefined;
	await expect(async () => {
		const resp = await gw('GET', '/meta');
		expect(resp.status, 'GET /meta through the OAM proxy').toBe(200);
		meta = await resp.json();
	}).toPass({intervals: [2_000, 5_000, 10_000], timeout: 90_000});
	const sa = meta?.[LB_PATH]?.fields?.serviceArguments;
	expect(sa, '/meta declares the LB serviceArguments').toBeTruthy();
	return TUNING.every(name => sa[name] !== undefined);
}

async function storedRule(name: string): Promise<Record<string, any> | undefined> {
	const list = await gwJson<{lbAttr?: any[]}>(`${LB_PATH}/all`);
	return (list.lbAttr ?? []).find(rule => rule.serviceArguments?.name === name)?.serviceArguments;
}

/** Opens the Add dialog on a fullproxy draft under the chwbl selector, AI Gateway section expanded. */
async function openChwblDraft(page: Page, name: string, vip: string, port: string): Promise<void> {
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	await field(page, 'Rule Name').fill(name);
	await expandSection(page, BASIC);
	await field(page, 'External IP').fill(vip);
	await field(page, 'Port Min').fill(port);
	await expandSection(page, ADVANCED);
	await selectOption(page, 'Mode', 'fullproxy');
	await selectOption(page, 'SEL', 'chwbl');
	await expandSection(page, AIGW);
}

async function addEndpoint(page: Page, ip: string): Promise<void> {
	const sec = await expandSection(page, ENDPOINTS);
	await sec.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', sec).first().fill(ip);
	await field(page, 'Target Port', sec).first().fill('9000');
}

/** Submits via Create, asserts the gateway accepted it; returns the POST body's serviceArguments. */
async function submitCreate(page: Page): Promise<Record<string, any>> {
	await page.mouse.move(0, 0); // dismiss any sticky accordion tooltip
	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
		dialogButton(page, 'Create').click(),
	]);
	expect((await req.response())?.status(), 'gateway accepted the LB create').toBeLessThan(300);
	await expectSuccessAndDismiss(page);
	return req.postDataJSON().serviceArguments;
}

function sentTuning(sent: Record<string, any>): string[] {
	return TUNING.filter(name => name in sent);
}

/** Selects the rule and opens the detail's AI Gateway tab. */
async function openAiDetail(page: Page, name: string): Promise<void> {
	await refreshUntilRow(page, name);
	await selectRowByText(page, name);
	await page.getByRole('tab', {name: 'AI Gateway', exact: true}).click();
}

test.describe('LB rule CHWBL ring tuning', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		declared = await gatewayDeclaresTuning();
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('@gw CH-default: an untouched chwbl rule sends no tuning and the detail shows what the gateway resolved', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare the CHWBL tuning fields in /meta');
		const name = 'e2e-lb-ch-default';
		await openChwblDraft(page, name, '203.0.113.191', '8591');
		// The inputs start empty: nothing here is a value the operator chose.
		await expect(field(page, LOAD_FACTOR)).toHaveValue('');
		await expect(field(page, REPLICATION)).toHaveValue('');
		await expect(field(page, SALT)).not.toBeChecked();
		await expect(dialog(page).getByText(SALT_WARNING)).toHaveCount(0);
		await addEndpoint(page, '198.51.100.191');

		const sent = await submitCreate(page);
		expect(sent.sel).toBe(8);
		expect(sentTuning(sent), 'untouched tuning inputs send nothing').toEqual([]);

		const stored = await storedRule(name);
		expect(stored, 'the rule is stored').toBeTruthy();
		expect(stored).toMatchObject({chwbl_mean_load_factor: 175, chwbl_replication: 256, chwbl_enable_cache_salt: false});

		// The rule carries no other AI setting; the resolved ring is still shown.
		await openAiDetail(page, name);
		await expect(detailValue(page, LOAD_FACTOR)).toHaveText('175');
		await expect(detailValue(page, REPLICATION)).toHaveText('256');
		await expect(detailValue(page, SALT)).toHaveText('Not required');
	});

	test('@gw CH-set: chosen values are sent, stored and read back, and requiring the salt warns first', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare the CHWBL tuning fields in /meta');
		const name = 'e2e-lb-ch-set';
		await openChwblDraft(page, name, '203.0.113.192', '8592');
		await field(page, LOAD_FACTOR).fill('125');
		await field(page, REPLICATION).fill('64');
		await field(page, SALT).check();
		await expect(dialog(page).getByText(SALT_WARNING)).toBeVisible();
		await addEndpoint(page, '198.51.100.192');

		const sent = await submitCreate(page);
		expect(sent).toMatchObject({sel: 8, chwbl_mean_load_factor: 125, chwbl_replication: 64, chwbl_enable_cache_salt: true});

		expect(await storedRule(name)).toMatchObject({chwbl_mean_load_factor: 125, chwbl_replication: 64, chwbl_enable_cache_salt: true});

		await openAiDetail(page, name);
		await expect(detailValue(page, LOAD_FACTOR)).toHaveText('125');
		await expect(detailValue(page, REPLICATION)).toHaveText('64');
		await expect(detailValue(page, SALT)).toHaveText('Required');
	});

	test('@gw CH-sel-away: values typed under chwbl do not travel once the selector moves away', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare the CHWBL tuning fields in /meta');
		const name = 'e2e-lb-ch-away';
		await openChwblDraft(page, name, '203.0.113.193', '8593');
		await field(page, LOAD_FACTOR).fill('125');
		await field(page, REPLICATION).fill('64');
		await field(page, SALT).check();

		await selectOption(page, 'SEL', 'rr');
		// A neighbouring control proves the section is still rendered.
		await expect(field(page, 'Session Header Name')).toBeVisible();
		await expect(field(page, LOAD_FACTOR)).toHaveCount(0);
		await expect(field(page, REPLICATION)).toHaveCount(0);
		await expect(field(page, SALT)).toHaveCount(0);
		await expect(dialog(page).getByText(SALT_WARNING)).toHaveCount(0);
		await addEndpoint(page, '198.51.100.193');

		// The gateway refuses any tuning field off the chwbl selectors, so an
		// accepted create is itself the proof that none was sent.
		const sent = await submitCreate(page);
		expect(sent.sel ?? 0).toBe(0);
		expect(sentTuning(sent), 'tuning is not sent off the chwbl selectors').toEqual([]);

		const stored = await storedRule(name);
		expect(stored, 'the rule is stored').toBeTruthy();
		expect(TUNING.filter(field => stored?.[field] !== undefined), 'no ring is stored on an rr rule').toEqual([]);
	});

	test('@gw CH-range: an out-of-range value stops in the form and never reaches the gateway', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare the CHWBL tuning fields in /meta');
		const name = 'e2e-lb-ch-range';
		const writes: string[] = [];
		page.on('request', request => {
			if (request.method() !== 'GET' && request.url().includes(`/netlox/v1${LB_PATH}`)) writes.push(`${request.method()} ${request.url()}`);
		});

		await openChwblDraft(page, name, '203.0.113.194', '8594');
		await addEndpoint(page, '198.51.100.194');
		const create = dialogButton(page, 'Create');
		await expect(create, 'the draft is submittable before a bad value goes in').toBeEnabled();

		// One below the floor.
		await field(page, LOAD_FACTOR).fill('99');
		await expect(dialog(page).getByText('CHWBL mean load factor must be an integer between 100 and 300.')).toBeVisible();
		await expect(create).toBeDisabled();
		// The floor itself is accepted.
		await field(page, LOAD_FACTOR).fill('100');
		await expect(dialog(page).getByText(/CHWBL mean load factor must be/)).toHaveCount(0);
		await expect(create).toBeEnabled();

		// One above the ceiling.
		await field(page, REPLICATION).fill('1025');
		await expect(dialog(page).getByText('CHWBL replication must be an integer between 1 and 1024.')).toBeVisible();
		await expect(create).toBeDisabled();
		await field(page, REPLICATION).fill('1024');
		await expect(create).toBeEnabled();

		// Requiring the salt while the hash flags leave the salt input out.
		await field(page, 'CHWBL Prefix Hash Flags').fill('1');
		await field(page, SALT).check();
		await expect(dialog(page).getByText(/Requiring cache_salt needs the cache_salt input/)).toBeVisible();
		await expect(create).toBeDisabled();
		await field(page, 'CHWBL Prefix Hash Flags').fill('9');
		await expect(create).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
		expect(writes, 'nothing was sent while the form was refusing').toEqual([]);
		expect(await storedRule(name), 'no rule was created').toBeUndefined();
	});

	test('@gw CH-meta: a control is not offered for a field the gateway does not declare', async ({page}) => {
		// The rest of /meta stays the gateway's own answer; only one field is
		// removed, so the other two controls must survive it.
		await page.route(META_RE, async (route: Route) => {
			const response = await route.fetch();
			const meta = await response.json();
			for (const entry of Object.values<any>(meta)) delete entry?.fields?.serviceArguments?.chwbl_replication;
			await route.fulfill({response, json: meta});
		});
		await page.reload();
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});

		await openChwblDraft(page, 'e2e-lb-ch-meta', '203.0.113.195', '8595');
		await expect(field(page, 'CHWBL Prefix Hash Flags')).toBeVisible();
		await expect(field(page, REPLICATION)).toHaveCount(0);
		if (declared) {
			await expect(field(page, LOAD_FACTOR)).toBeVisible();
			await expect(field(page, SALT)).toBeVisible();
		}
		await dialogButton(page, 'Cancel').click();
		await expect(detailCaption(page, REPLICATION)).toHaveCount(0);
	});
});
