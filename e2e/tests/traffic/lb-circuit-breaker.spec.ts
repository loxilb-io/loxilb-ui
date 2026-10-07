//---------------------------------------------------------
// LB rule form — per-endpoint circuit breaker (cb_enable), gateway only.
//
// The gateway resolves an omitted cb_enable itself: on for a P/D rule, off
// otherwise. GET reports the resolved state and omits the field when it is
// off. So the switch has to show what the rule will run with while sending
// nothing the operator did not choose, and the detail has to read an absent
// field as off — never as the P/D default.
//
// What each case would catch:
// - a switch that announces its displayed default into the POST;
// - a read-back that shows the create default instead of the stored state;
// - a value left from an earlier mode choice travelling off fullproxy;
// - an edit dialog that turns the read-back into a change of its own;
// - the switch surviving on a gateway whose /meta does not declare the field.
//
// Live against the gateway; only the last case stubs one endpoint (/meta).
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, fullproxyVip, gw, gwJson, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {detailCaption, detailValue} from '../../helpers/detail';
import {dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

// A fullproxy rule is a listener the gateway binds, so its VIP is an address
// of the gateway (helpers/api.ts, fullproxyVip).
const FP_VIP = fullproxyVip();

const LB_PATH = '/config/loadbalancer';
const META_RE = /\/netlox\/v1\/meta(\?.*)?$/;
const BASIC = /^Basic Settings/;
const ADVANCED = /^Advanced Settings/;
const AIGW = /^AI Gateway/;
const ENDPOINTS = /^Endpoints$/;
const BREAKER = 'Circuit Breaker';

let instName: string;
let declared: boolean;

/** Whether this gateway's own /meta declares cb_enable on the LB create body. */
async function gatewayDeclaresBreaker(): Promise<boolean> {
	// /meta is a large document; over a slow hop the OAM proxy can cut it at its
	// own deadline and answer 502. That is the transport, not the answer, so the
	// read is repeated rather than letting it decide what this suite runs.
	let meta: Record<string, any> | undefined;
	await expect(async () => {
		const resp = await gw('GET', '/meta');
		expect(resp.status, 'GET /meta through the OAM proxy').toBe(200);
		meta = await resp.json();
	}).toPass({intervals: [2_000, 5_000, 10_000], timeout: 90_000});
	const sa = meta?.[LB_PATH]?.fields?.serviceArguments;
	expect(sa, '/meta declares the LB serviceArguments').toBeTruthy();
	return JSON.stringify(sa).includes('"cb_enable"');
}

async function storedRule(name: string): Promise<Record<string, any> | undefined> {
	const list = await gwJson<{lbAttr?: any[]}>(`${LB_PATH}/all`);
	return (list.lbAttr ?? []).find(rule => rule.serviceArguments?.name === name)?.serviceArguments;
}

async function openFullproxyDraft(page: Page, name: string, vip: string, port: string): Promise<void> {
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	await field(page, 'Rule Name').fill(name);
	await expandSection(page, BASIC);
	await field(page, 'External IP').fill(vip);
	await field(page, 'Port Min').fill(port);
	await expandSection(page, ADVANCED);
	await selectOption(page, 'Mode', 'fullproxy');
}

async function addEndpoint(page: Page, index: number, ip: string, port: string, role?: 'prefill' | 'decode'): Promise<void> {
	const sec = await expandSection(page, ENDPOINTS);
	await sec.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', sec).nth(index).fill(ip);
	await field(page, 'Target Port', sec).nth(index).fill(port);
	if (role) await selectOption(page, 'EP Role', role, index);
}

/** Turns the open fullproxy draft into a P/D rule with one prefill and one decode endpoint. */
async function makePd(page: Page, octet: number): Promise<void> {
	await expandSection(page, AIGW);
	await selectOption(page, 'Topology', 'P/D disaggregation');
	await addEndpoint(page, 0, `198.51.100.${octet}`, '9000', 'prefill');
	await addEndpoint(page, 1, `198.51.100.${octet + 1}`, '9000', 'decode');
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

async function expectDetail(page: Page, name: string, state: 'Enabled' | 'Disabled'): Promise<void> {
	await refreshUntilRow(page, name);
	await selectRowByText(page, name);
	await expect(detailValue(page, BREAKER)).toHaveText(state);
}

test.describe('LB rule circuit breaker', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		declared = await gatewayDeclaresBreaker();
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

	test('@gw CB-default-pd: an untouched P/D rule shows the breaker on, sends nothing, and reads back Enabled', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare cb_enable in /meta');
		const name = 'e2e-lb-cb-pd';
		await openFullproxyDraft(page, name, FP_VIP, '8581');
		// Plain fullproxy first: the displayed default follows the topology.
		await expect(field(page, BREAKER)).not.toBeChecked();
		await makePd(page, 181);
		await expect(field(page, BREAKER)).toBeChecked();

		const sent = await submitCreate(page);
		expect(sent.pd_disagg_mode).toBe(true);
		expect('cb_enable' in sent, 'an untouched switch sends no cb_enable').toBe(false);

		expect((await storedRule(name))?.cb_enable, 'the gateway resolved the omission to on').toBe(true);
		await expectDetail(page, name, 'Enabled');
	});

	test('@gw CB-off-pd: switching a P/D rule off sends false and reads back Disabled, not the P/D default', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare cb_enable in /meta');
		const name = 'e2e-lb-cb-pd-off';
		await openFullproxyDraft(page, name, FP_VIP, '8582');
		await makePd(page, 183);
		await field(page, BREAKER).uncheck();

		const sent = await submitCreate(page);
		expect(sent.cb_enable).toBe(false);

		// GET omits the field when the breaker is off; an explicit false is fine too.
		expect((await storedRule(name))?.cb_enable ?? false, 'the gateway stored the breaker off').toBe(false);
		await expectDetail(page, name, 'Disabled');
	});

	test('@gw CB-plain: an untouched plain fullproxy rule sends nothing and reads back Disabled', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare cb_enable in /meta');
		const name = 'e2e-lb-cb-plain';
		await openFullproxyDraft(page, name, FP_VIP, '8585');
		await expect(field(page, BREAKER)).not.toBeChecked();
		await addEndpoint(page, 0, '198.51.100.185', '9000');

		const sent = await submitCreate(page);
		expect('cb_enable' in sent, 'an untouched switch sends no cb_enable').toBe(false);
		expect((await storedRule(name))?.cb_enable ?? false, 'the gateway resolved the omission to off').toBe(false);
		await expectDetail(page, name, 'Disabled');
	});

	test('@gw CB-plain-on: an explicit on is honoured on a rule whose default is off', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare cb_enable in /meta');
		const name = 'e2e-lb-cb-plain-on';
		await openFullproxyDraft(page, name, FP_VIP, '8586');
		await field(page, BREAKER).check();
		await addEndpoint(page, 0, '198.51.100.186', '9000');

		const sent = await submitCreate(page);
		expect(sent.cb_enable).toBe(true);
		expect((await storedRule(name))?.cb_enable).toBe(true);
		await expectDetail(page, name, 'Enabled');
	});

	test('@gw CB-mode: the switch is locked off fullproxy, and a choice made under fullproxy does not travel', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare cb_enable in /meta');
		const name = 'e2e-lb-cb-dnat';
		await openFullproxyDraft(page, name, FP_VIP, '8587');
		await field(page, BREAKER).check();
		await selectOption(page, 'Mode', 'dnat');
		await expect(field(page, BREAKER)).toBeDisabled();
		await expect(field(page, BREAKER)).not.toBeChecked();
		await addEndpoint(page, 0, '198.51.100.187', '9000');

		const sent = await submitCreate(page);
		expect(sent.mode).not.toBe(4);
		expect('cb_enable' in sent, 'cb_enable is not sent off fullproxy').toBe(false);

		// The detail has no breaker row on a rule that is not fullproxy.
		await refreshUntilRow(page, name);
		await selectRowByText(page, name);
		await expect(detailCaption(page, 'Mode')).toBeVisible();
		await expect(detailCaption(page, BREAKER)).toHaveCount(0);
	});

	test('@gw CB-edit: the edit dialog shows the stored state read-only and an untouched Update changes nothing', async ({page}) => {
		test.skip(!declared, 'this gateway does not declare cb_enable in /meta');
		const name = 'e2e-lb-cb-edit';
		const create = await gw('POST', LB_PATH, {
			serviceArguments: {name, externalIP: FP_VIP, port: 8588, protocol: 'tcp', sel: 0, mode: 4, pd_disagg_mode: true, cb_enable: false},
			endpoints: [
				{endpointIP: '198.51.100.188', targetPort: 9000, weight: 1, ep_role: 1},
				{endpointIP: '198.51.100.189', targetPort: 9000, weight: 1, ep_role: 2},
			],
		});
		expect(create.status, 'API seed: P/D rule with the breaker off').toBeLessThan(300);
		await refreshUntilRow(page, name);

		const writes: string[] = [];
		page.on('request', request => {
			if (request.method() !== 'GET' && request.url().includes(`/netlox/v1${LB_PATH}`)) writes.push(`${request.method()} ${request.url()}`);
		});

		await selectRowByText(page, name);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		await expandSection(page, ADVANCED);
		// A P/D rule whose breaker is off must not show the P/D create default.
		await expect(field(page, BREAKER)).not.toBeChecked();
		await expect(field(page, BREAKER)).toBeDisabled();

		await dialogButton(page, 'Update').click();
		await expect(dialog(page).getByText('No changes to apply.')).toBeVisible();
		await dialogButton(page, 'OK').click();
		expect(writes, 'an untouched edit sends no write').toEqual([]);
		expect((await storedRule(name))?.cb_enable ?? false, 'the breaker is still off').toBe(false);
	});

	test('@gw CB-meta: the switch is not offered when the gateway does not declare the field', async ({page}) => {
		// The rest of /meta stays the gateway's own answer; only cb_enable is removed.
		await page.route(META_RE, async (route: Route) => {
			const response = await route.fetch();
			const meta = await response.json();
			for (const entry of Object.values<any>(meta)) delete entry?.fields?.serviceArguments?.cb_enable;
			await route.fulfill({response, json: meta});
		});
		await page.reload();
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});

		await openFullproxyDraft(page, 'e2e-lb-cb-meta', FP_VIP, '8589');
		// A neighbouring control proves the section rendered before the absence is asserted.
		await expect(field(page, 'Inactive Timeout')).toBeVisible();
		await expect(field(page, BREAKER)).toHaveCount(0);
		await dialogButton(page, 'Cancel').click();
	});
});
