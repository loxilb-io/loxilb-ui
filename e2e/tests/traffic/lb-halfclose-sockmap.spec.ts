//---------------------------------------------------------
// LB rule detail — half-close and sockmap read-back, gateway only.
//
// Both rows say what a fullproxy rule runs with, as the gateway reports it.
// The half-close mode is resolved from three places (the rule, the process
// default, a process-wide block), so the row names the source with the mode;
// a default the gateway could not apply carries its own reason. A gateway that
// reports neither field gets no row — not an "Off" made up here.
//
// What each case would catch:
// - a row invented for a gateway that does not report the field;
// - a row that drops the source, or the reason a default was not applied;
// - a mode or source this UI does not know being replaced by a guess;
// - either row leaking onto a rule that is not fullproxy.
//
// The live cases assert against what this gateway stored. The states a shared
// testbed cannot be put into (a process-wide block, a default that was not
// applied, values from a newer gateway) are fed through one stubbed read of
// the rule list; everything else in that read stays the gateway's own answer.
//---------------------------------------------------------
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {detailCaption, detailValue} from '../../helpers/detail';
import {refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const LB_PATH = '/config/loadbalancer';
const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const HALF_CLOSE = 'Half-Close';
const SOCKMAP = 'Sockmap Mode';
const BREAKER = 'Circuit Breaker';

const SOCKMAP_NAMES: Record<string, string> = {
	off: 'Off',
	both: 'Both directions',
	request: 'Request only (client to backend)',
	response: 'Response only (backend to client)',
};

interface HalfCloseEffective {
	mode?: string;
	source?: string;
	not_applied?: string;
}

let instName: string;

/** The half-close row text a reported state must produce. */
function halfCloseText(effective: HalfCloseEffective): string {
	const mode = effective.mode === 'hold' ? 'Hold' : effective.mode === 'off' ? 'Off' : String(effective.mode);
	if (effective.not_applied) return `${mode} (gateway default not applied: ${effective.not_applied})`;
	if (effective.source === 'rule') return `${mode} (set on the rule)`;
	if (effective.source === 'default') return `${mode} (gateway default)`;
	if (effective.source === 'blocked') return `${mode} (holds are blocked on this gateway)`;
	return effective.source ? `${mode} (${effective.source})` : mode;
}

async function seedRule(serviceArguments: Record<string, unknown>, endpoints: Record<string, unknown>[]): Promise<void> {
	const resp = await gw('POST', LB_PATH, {serviceArguments: {protocol: 'tcp', sel: 0, ...serviceArguments}, endpoints});
	expect(resp.status, `API seed: ${serviceArguments.name}`).toBeLessThan(300);
}

function endpoint(octet: number, role?: 1 | 2): Record<string, unknown> {
	return {endpointIP: `198.51.100.${octet}`, targetPort: 9000, weight: 1, ...(role ? {ep_role: role} : {})};
}

async function storedRule(name: string): Promise<Record<string, any>> {
	const list = await gwJson<{lbAttr?: any[]}>(`${LB_PATH}/all`);
	const stored = (list.lbAttr ?? []).find(rule => rule.serviceArguments?.name === name)?.serviceArguments;
	expect(stored, `${name} is stored`).toBeTruthy();
	return stored;
}

/** Asserts a detail row: its value when one is expected, its absence otherwise. */
async function expectRow(page: Page, label: string, expected: string | undefined): Promise<void> {
	if (expected === undefined) await expect(detailCaption(page, label), `no ${label} row`).toHaveCount(0);
	else await expect(detailValue(page, label)).toHaveText(expected);
}

/**
 * Re-reads the rule list through the toolbar and selects the rule again.
 *
 * A page reload would not do: the list is restored from the persisted query
 * cache and counts as fresh for a few seconds, so a reload inside that window
 * issues no read and a stubbed one is never asked for.
 */
async function rereadAndSelect(page: Page, name: string): Promise<void> {
	await Promise.all([
		page.waitForResponse(response => LB_ALL_RE.test(response.url()) && response.request().method() === 'GET'),
		toolbarButton(page, 'Refresh').click(),
	]);
	await selectRowByText(page, name);
}

async function openDetail(page: Page, name: string): Promise<void> {
	await refreshUntilRow(page, name);
	await selectRowByText(page, name);
	// A row every rule has: the panel is rendered before any absence is asserted.
	await expect(detailCaption(page, 'Mode')).toBeVisible();
}

test.describe('LB rule half-close and sockmap read-back', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
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

	test('@gw HC-fullproxy: a fullproxy rule shows exactly what the gateway reports, and no row for what it does not', async ({page}) => {
		const name = 'e2e-lb-hc-fp';
		await seedRule({name, externalIP: '203.0.113.201', port: 8601, mode: 4}, [endpoint(201)]);
		const stored = await storedRule(name);
		const effective: HalfCloseEffective | undefined = stored.half_close_effective;

		await openDetail(page, name);
		await expectRow(page, HALF_CLOSE, effective?.mode ? halfCloseText(effective) : undefined);
		await expectRow(page, SOCKMAP, stored.sockMapMode ? SOCKMAP_NAMES[stored.sockMapMode] ?? stored.sockMapMode : undefined);
	});

	test('@gw HC-rule: a mode set on the rule reads back as the rule\'s own choice', async ({page}) => {
		const name = 'e2e-lb-hc-rule';
		await seedRule({name, externalIP: '203.0.113.202', port: 8602, mode: 4, half_close_mode: 'hold'}, [endpoint(202)]);
		const effective: HalfCloseEffective | undefined = (await storedRule(name)).half_close_effective;
		test.skip(!effective?.mode, 'this gateway does not report half_close_effective');

		// Whatever the gateway resolved, the row has to say it — a block that
		// overrides the rule included.
		expect(['rule', 'blocked'], 'a rule that asks for hold is resolved from the rule or a block').toContain(effective?.source);
		await openDetail(page, name);
		await expectRow(page, HALF_CLOSE, halfCloseText(effective!));
	});

	test('@gw HC-pd: a P/D rule shows why the gateway default is not applied to it', async ({page}) => {
		const name = 'e2e-lb-hc-pd';
		await seedRule({name, externalIP: '203.0.113.203', port: 8603, mode: 4, pd_disagg_mode: true}, [endpoint(203, 1), endpoint(204, 2)]);
		const effective: HalfCloseEffective | undefined = (await storedRule(name)).half_close_effective;
		test.skip(!effective?.mode, 'this gateway does not report half_close_effective');
		test.skip(!effective?.not_applied, `this gateway applies its default to a P/D rule (${JSON.stringify(effective)})`);

		await openDetail(page, name);
		await expectRow(page, HALF_CLOSE, halfCloseText(effective!));
		await expect(detailValue(page, HALF_CLOSE)).toContainText(effective!.not_applied!);
	});

	test('@gw HC-states: every reported state is shown as reported, known or not', async ({page}) => {
		const name = 'e2e-lb-hc-states';
		await seedRule({name, externalIP: '203.0.113.205', port: 8605, mode: 4}, [endpoint(205)]);
		await refreshUntilRow(page, name);

		// One stubbed read: the gateway's own list, with this rule's two
		// read-back fields replaced by the state under test.
		let patch: {half_close_effective?: HalfCloseEffective; sockMapMode?: string} = {};
		let served = 0;
		await page.route(LB_ALL_RE, async (route: Route) => {
			const response = await route.fetch();
			const body = await response.json();
			for (const rule of body.lbAttr ?? []) {
				if (rule.serviceArguments?.name !== name) continue;
				delete rule.serviceArguments.half_close_effective;
				delete rule.serviceArguments.sockMapMode;
				Object.assign(rule.serviceArguments, patch);
				served++;
			}
			await route.fulfill({response, json: body});
		});

		const states: {state: typeof patch; halfClose?: string; sockMap?: string}[] = [
			{state: {half_close_effective: {mode: 'hold', source: 'rule'}, sockMapMode: 'both'}, halfClose: 'Hold (set on the rule)', sockMap: 'Both directions'},
			{state: {half_close_effective: {mode: 'off', source: 'default'}, sockMapMode: 'request'}, halfClose: 'Off (gateway default)', sockMap: 'Request only (client to backend)'},
			{state: {half_close_effective: {mode: 'off', source: 'blocked'}, sockMapMode: 'response'}, halfClose: 'Off (holds are blocked on this gateway)', sockMap: 'Response only (backend to client)'},
			{state: {half_close_effective: {mode: 'off', source: 'default', not_applied: 'hold needs a plain tcp listener'}, sockMapMode: 'off'}, halfClose: 'Off (gateway default not applied: hold needs a plain tcp listener)', sockMap: 'Off'},
			// A newer gateway: names this UI has no words for are passed through.
			{state: {half_close_effective: {mode: 'drain', source: 'operator'}, sockMapMode: 'egress'}, halfClose: 'drain (operator)', sockMap: 'egress'},
			{state: {half_close_effective: {mode: 'hold'}}, halfClose: 'Hold', sockMap: undefined},
			// A source without a mode says nothing about what is in force.
			{state: {half_close_effective: {source: 'default'}}, halfClose: undefined, sockMap: undefined},
			{state: {}, halfClose: undefined, sockMap: undefined},
		];
		for (const {state, halfClose, sockMap} of states) {
			patch = state;
			const before = served;
			await rereadAndSelect(page, name);
			expect(served, `the stubbed read was served for ${JSON.stringify(state)}`).toBeGreaterThan(before);
			// The breaker row sits beside these two on every fullproxy rule.
			await expect(detailCaption(page, BREAKER), `detail rendered for ${JSON.stringify(state)}`).toBeVisible();
			await expectRow(page, HALF_CLOSE, halfClose);
			await expectRow(page, SOCKMAP, sockMap);
		}
	});

	test('@gw HC-dnat: a rule that is not fullproxy shows neither row, whatever the read carries', async ({page}) => {
		const name = 'e2e-lb-hc-dnat';
		await seedRule({name, externalIP: '203.0.113.206', port: 8606, mode: 0}, [endpoint(206)]);
		await refreshUntilRow(page, name);

		let served = 0;
		await page.route(LB_ALL_RE, async (route: Route) => {
			const response = await route.fetch();
			const body = await response.json();
			for (const rule of body.lbAttr ?? []) {
				if (rule.serviceArguments?.name !== name) continue;
				Object.assign(rule.serviceArguments, {half_close_effective: {mode: 'hold', source: 'default'}, sockMapMode: 'both'});
				served++;
			}
			await route.fulfill({response, json: body});
		});
		await rereadAndSelect(page, name);
		expect(served, 'the stubbed read was served').toBeGreaterThan(0);

		await expect(detailCaption(page, 'Mode')).toBeVisible();
		await expectRow(page, HALF_CLOSE, undefined);
		await expectRow(page, SOCKMAP, undefined);
	});
});
