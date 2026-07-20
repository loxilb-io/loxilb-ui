//---------------------------------------------------------
// Shared scaffolding for the cicd-scenario specs
// (docs/E2E_CICD_SCENARIO_TEST_PLAN.md).
//
// Each cicd/* scenario is replayed as a UI LB-rule recipe and
// validated against the gateway's REST read-back — NO traffic.
// A recipe records the scenario's SEMANTIC config (proto / mode /
// select / timeout / endpoints) but always substitutes the safety
// envelope's documentation IPs + an `e2e-cicd-` name, so a stray
// can never touch real config and the leak detector can find it.
//
// The drive/assert helpers are hoisted from traffic/lb.spec.ts so
// the per-scenario specs stay thin wrappers (plan §13.5).
//---------------------------------------------------------
import {expect, Page} from '@playwright/test';
import {gw, gwJson} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, showAllRows, toolbarButton} from '../../helpers/table';

export const LB_PATH = '/config/loadbalancer';

// Enum → send_value maps (mirror src/assets/json/{sels,modes}.json).
export const SEL_ID = {rr: 0, hash: 1, priority: 2, persist: 3, lc: 4, chwbl: 8} as const;
export const MODE_ID = {dnat: 0, onearm: 1, fullnat: 2, dsr: 3, fullproxy: 4, hostonearm: 5, aigw: 6} as const;

export type Proto = 'tcp' | 'udp' | 'sctp';
export type SelName = keyof typeof SEL_ID;
export type ModeName = keyof typeof MODE_ID;

export interface RecipeEndpoint {
	ip: string;
	targetPort: string;
	/** default '1' */
	weight?: string;
}

export interface LbRecipe {
	/** Origin: cicd/<dir> — cited in every spec header. */
	cicd: string;
	/** e2e-cicd-<slug> — swept by the leak detector. */
	name: string;
	vip: string;
	port: string;
	portMax?: string;
	/** default 'tcp' */
	protocol?: Proto;
	/** default 'rr' */
	sel?: SelName;
	/** default 'dnat' */
	mode?: ModeName;
	/** seconds; omitted → not set */
	inactiveTimeout?: string;
	/** cicd `--monitor`: enables the health monitor (Advanced ‘Enable Monitor’). */
	monitor?: boolean;
	/** cicd `--sources=`: CIDR prefixes for the Allowed Sources accordion. */
	allowedSources?: string[];
	endpoints: RecipeEndpoint[];
}

/** The numeric serviceArguments the gateway must echo back for a recipe. */
export function expectedServiceArguments(r: LbRecipe): Record<string, unknown> {
	const sa: Record<string, unknown> = {
		name: r.name,
		externalIP: r.vip,
		port: Number(r.port),
		protocol: r.protocol ?? 'tcp',
		sel: SEL_ID[r.sel ?? 'rr'],
		mode: MODE_ID[r.mode ?? 'dnat'],
	};
	if (r.portMax) sa.portMax = Number(r.portMax);
	if (r.inactiveTimeout) sa.inactiveTimeOut = Number(r.inactiveTimeout);
	if (r.monitor) sa.monitor = true;
	return sa;
}

const PROTO_OPTION: Record<Proto, string | undefined> = {tcp: undefined, udp: 'UDP', sctp: 'SCTP'};

/**
 * Drives the LB Add dialog to reproduce `r`, submits, and returns the POST
 * body. Asserts the gateway accepted (2xx) + the Success popup. Only the
 * fields a recipe sets are touched; defaults (rr/dnat/tcp) are left alone.
 */
export async function driveLbCreate(page: Page, r: LbRecipe): Promise<any> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('Add Load Balancer Rule')).toBeVisible();

	// Rule Name + Basic Settings.
	await field(page, 'Rule Name').fill(r.name);
	await expandSection(page, /^Basic Settings/);
	const protoOpt = PROTO_OPTION[r.protocol ?? 'tcp'];
	if (protoOpt) await selectOption(page, 'Protocol', protoOpt);
	await field(page, 'External IP').fill(r.vip);
	await field(page, 'Port Min').fill(r.port);
	if (r.portMax) await field(page, 'Port Max').fill(r.portMax);

	// Advanced Settings — only when the recipe diverges from rr/dnat.
	if ((r.sel && r.sel !== 'rr') || (r.mode && r.mode !== 'dnat') || r.inactiveTimeout || r.monitor) {
		await expandSection(page, /^Advanced Settings/);
		if (r.sel && r.sel !== 'rr') await selectOption(page, 'SEL', r.sel);
		if (r.mode && r.mode !== 'dnat') await selectOption(page, 'Mode', r.mode);
		if (r.inactiveTimeout) await field(page, 'Inactive Timeout').fill(r.inactiveTimeout);
		if (r.monitor) await field(page, 'Enable Monitor').check();
	}

	// Allowed Sources (cicd --sources=): one prefix row per CIDR.
	if (r.allowedSources?.length) {
		const secA = await expandSection(page, /^Allowed Sources$/);
		for (let i = 0; i < r.allowedSources.length; i++) {
			await secA.getByRole('button', {name: 'Add', exact: true}).click();
			await field(page, 'IP Address', secA).nth(i).fill(r.allowedSources[i]);
		}
	}

	// Endpoints.
	const sec = await expandSection(page, /^Endpoints$/);
	for (let i = 0; i < r.endpoints.length; i++) {
		const ep = r.endpoints[i];
		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).nth(i).fill(ep.ip);
		await field(page, 'Target Port', sec).nth(i).fill(ep.targetPort);
		if (ep.weight !== undefined) await field(page, 'Weight', sec).nth(i).fill(ep.weight);
	}

	await page.mouse.move(0, 0); // dismiss sticky accordion tooltip
	const [req] = await Promise.all([
		page.waitForRequest(rq => rq.method() === 'POST' && rq.url().includes(LB_PATH)),
		dialogButton(page, 'Create').click(),
	]);
	const resp = await req.response();
	expect(resp?.status(), `gateway accepted ${r.cicd} LB create`).toBeLessThan(300);
	await expectSuccessAndDismiss(page);
	return req.postDataJSON();
}

/**
 * The REST validation: re-GET the rule the UI created and assert the gateway
 * stored the recipe verbatim (serviceArguments + endpoint IPs/weights).
 */
export async function assertLbReadback(r: LbRecipe): Promise<void> {
	const data = await gwJson<{lbAttr?: any[]}>(`${LB_PATH}/all`);
	const rule = (data.lbAttr ?? []).find(x => x.serviceArguments?.name === r.name);
	expect(rule, `${r.cicd}: rule ${r.name} present in gateway read-back`).toBeTruthy();
	// loxilb's GET omits zero-valued defaults (sel=rr=0, mode=dnat=0), so
	// fill them back before matching the recipe's expected numeric values.
	const sa = {sel: 0, mode: 0, ...rule.serviceArguments};
	expect(sa).toMatchObject(expectedServiceArguments(r));
	// Full endpoint round-trip: IP + targetPort + weight, not just the IP set.
	// This is what makes the weighted (wrr) scenarios meaningful — a dropped or
	// coerced weight is a real gateway/UI bug, and asserting only IPs hid it.
	// loxilb may omit weight when it equals the default 1, so normalize missing
	// weight to 1 before comparing (mirrors the sel/mode zero-default handling).
	const gotEps = (rule.endpoints ?? [])
		.map((e: any) => ({ip: e.endpointIP, targetPort: Number(e.targetPort), weight: Number(e.weight ?? 1)}))
		.sort((a: any, b: any) => a.ip.localeCompare(b.ip));
	const wantEps = r.endpoints
		.map(e => ({ip: e.ip, targetPort: Number(e.targetPort), weight: Number(e.weight ?? '1')}))
		.sort((a, b) => a.ip.localeCompare(b.ip));
	expect(gotEps, `${r.cicd}: endpoint IP/targetPort/weight round-trip`).toEqual(wantEps);
}

/** API delete-by-name (afterEach cleanup); tolerant if already gone. */
export async function cleanupLbByName(name: string): Promise<void> {
	await gw('DELETE', `${LB_PATH}/name/${encodeURIComponent(name)}`);
}

/** Standard per-scenario flow: navigate → drive → assert body + read-back. */
export async function runLbScenario(page: Page, instName: string, r: LbRecipe): Promise<void> {
	await page.goto(`instance/traffic/lb?name=${instName}`); // relative — baseURL carries /netlox
	await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	await showAllRows(page);

	const body = await driveLbCreate(page, r);
	expect(body.serviceArguments).toMatchObject(expectedServiceArguments(r));
	expect(body.endpoints).toHaveLength(r.endpoints.length);
	// Client-side validation state must never leak into the payload.
	expect(body.isValid).toBeUndefined();
	expect(body.errors).toBeUndefined();
	if (r.allowedSources?.length) {
		expect(body.allowedSources).toEqual(r.allowedSources.map(prefix => ({prefix})));
	}

	await refreshUntilRow(page, r.name);
	await assertLbReadback(r);
}

export {refreshUntilGone}; // re-export for specs that verify UI delete
