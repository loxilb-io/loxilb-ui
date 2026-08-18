//---------------------------------------------------------
// Shared scaffolding for the cicd firewall-rule scenarios
//.
//
// The `ipmasquerade`/`ipmasquerade6` cicd scenarios create a
// source-NAT (masquerade) firewall rule via
//   loxicmd create firewall --firewallRule="portName:…" --snat=<ip>
// which maps to the UI Firewall form's `opts.doSnat + opts.toIP`.
//
// Safety: the cicd recipe keys the rule on a real interface
// (`portName:ellb1l3ep1`) — untestable and un-sweepable on a shared
// testbed. We reproduce the SAME config surface (a doSnat rule with a
// toIP) but key it on a documentation-range `sourceIP` so the leak
// detector / sweepFirewallRules can always find and remove it, and the
// SNAT target is a documentation IP too. Nothing touches real config.
//---------------------------------------------------------
import {expect, Page} from '@playwright/test';
import {gw, gwJson} from '../../helpers/api';
import {dialogButton, expectSuccessAndDismiss, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {refreshUntilRow, showAllRows, toolbarButton} from '../../helpers/table';

export const FW_PATH = '/config/firewall';

export interface FwRecipe {
	/** Origin: cicd/<dir> — cited in every spec header. */
	cicd: string;
	/** Documentation-range source the rule matches (keeps it sweepable). */
	sourceIP: string;
	/** cicd `--snat`: enable source-NAT (masquerade) on the matched traffic. */
	doSnat: boolean;
	/** cicd `--snat=<ip>`: the address matched traffic is translated to. */
	toIP: string;
	/** optional SNAT target port. */
	toPort?: string;
	/** IANA protocol number (default 6/tcp — the DELETE key includes protocol). */
	protocol?: number;
}

/**
 * Drives the Firewall Add dialog to reproduce `r`, submits, and returns the
 * POST body. Asserts the gateway accepted (2xx) + the Success popup. The
 * Firewall form is flat (no accordions), so every field is directly present.
 */
export async function driveFirewallCreate(page: Page, r: FwRecipe): Promise<any> {
	// The firewall Add dialog has no heading — detect it by the form section.
	await openToolbarDialog(page, 'Add', 'Firewall Rule Arguments');

	await field(page, 'Source IP').fill(r.sourceIP);
	if (r.doSnat) await field(page, 'Do SNAT').check();
	await field(page, 'To IP').fill(r.toIP);
	if (r.toPort) await field(page, 'To Port').fill(r.toPort);

	await page.mouse.move(0, 0); // dismiss any sticky ParamBox tooltip over the footer
	const [req] = await Promise.all([
		page.waitForRequest(rq => rq.method() === 'POST' && rq.url().includes(FW_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	const resp = await req.response();
	expect(resp?.status(), `gateway accepted ${r.cicd} firewall create`).toBeLessThan(300);
	await expectSuccessAndDismiss(page);
	return req.postDataJSON();
}

/** The REST validation: re-GET the firewall rules and assert the SNAT rule persisted. */
export async function assertFirewallReadback(r: FwRecipe): Promise<void> {
	const data = await gwJson<{fwAttr?: any[]}>(`${FW_PATH}/all`);
	const rule = (data.fwAttr ?? []).find(x => x.ruleArguments?.sourceIP === r.sourceIP);
	expect(rule, `${r.cicd}: firewall rule for ${r.sourceIP} present in read-back`).toBeTruthy();
	expect(rule.opts?.doSnat, `${r.cicd}: doSnat round-trips`).toBe(r.doSnat);
	expect(rule.opts?.toIP, `${r.cicd}: SNAT toIP round-trips`).toBe(r.toIP);
}

/** DELETE the rule by its documentation-range source (afterEach cleanup); tolerant if gone. */
export async function cleanupFirewallBySource(sourceIP: string): Promise<void> {
	await gw('DELETE', `${FW_PATH}?sourceIP=${encodeURIComponent(sourceIP)}`);
}

/** Standard per-scenario flow: navigate → drive → assert POST body + read-back. */
export async function runFirewallScenario(page: Page, instName: string, r: FwRecipe): Promise<void> {
	await page.goto(`instance/traffic/fw?name=${instName}`); // relative — baseURL carries /netlox
	await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	await showAllRows(page);

	const body = await driveFirewallCreate(page, r);
	expect(body.ruleArguments?.sourceIP).toBe(r.sourceIP);
	expect(body.opts?.doSnat).toBe(r.doSnat);
	expect(body.opts?.toIP).toBe(r.toIP);
	// Client-side validation state must never leak into the payload.
	expect(body.isValid).toBeUndefined();
	expect(body.errors).toBeUndefined();

	await refreshUntilRow(page, r.sourceIP);
	await assertFirewallReadback(r);
}
