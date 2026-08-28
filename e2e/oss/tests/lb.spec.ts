//---------------------------------------------------------
// LB Rule page CRUD — loxilb-oss.
// POST/DELETE /config/loadbalancer*, payload IServiceConfiguration.
// Entities use e2e- names + reserved documentation IPs.
//
// Counterpart of tests/traffic/lb.spec.ts. Where upstream loxilb's write
// semantics differ from the gateway's, this file asserts UPSTREAM's — the
// differences are behavioural, not cosmetic, and were verified live against
// 0.9.8-dev:
//
// | behaviour        | gateway                  | loxilb-oss                    |
// |------------------|--------------------------|-------------------------------|
// | duplicate POST   | 200, upserts the rule    | 409 or 200 — state-dependent  |
// | per-VIP GET/PATCH| 200 / merge-patch        | 405 (only DELETE is allowed)  |
// | sa edit          | PATCH changed keys       | DELETE + re-POST (no in-place)|
// | endpoint-only    | PATCH endpoints          | plain re-POST reconciles      |
// | LB probe types   | tcp/http/https/tls-hello | connect probes only           |
// | sel              | 0-10 (incl. chwbl)       | 0-6 (incl. n2/n3)             |
//
// sel=n3 (6) is UDP-only in the datapath on BOTH products (400
// "non-udp-n3-args") — that one is not a flavor difference, and the same case
// exists in the gateway spec.
//
// The edit paths and the probe-option set live in gating.spec.ts, which owns
// every assertion whose subject is "the flavor gate"; this file owns the CRUD.
//
// Not exercisable via the UI (documented gaps, not regressions):
// - privateIP (fullnat helper) — field commented out of the form
// - proxyprotocolv2 / block — fields commented out
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {gw, gwJson, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';
import {confirmDelete, dialog, dialogButton, expectErrorAndDismiss, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {refreshUntilGone, refreshUntilRow, rowByText, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const LB_PATH = '/config/loadbalancer';

//---------------------------------------------------------
// API seed (D/E/V fixtures)
//---------------------------------------------------------
interface SeedLb {
	name: string;
	externalIP: string;
	port: number;
	endpointIP: string;
}

async function apiCreateLb(args: SeedLb): Promise<void> {
	const resp = await gw('POST', LB_PATH, {
		serviceArguments: {name: args.name, externalIP: args.externalIP, port: args.port, protocol: 'tcp', sel: 0, mode: 0},
		endpoints: [{endpointIP: args.endpointIP, targetPort: args.port, weight: 1}],
	});
	expect(resp.status, `API seed create ${args.name}`).toBeLessThan(300);
}

//---------------------------------------------------------
// Dialog helpers (accordion-sectioned form)
//---------------------------------------------------------
function field(page: Page, label: string, root?: Locator) {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return (root ?? dialog(page)).getByLabel(new RegExp(`^${escaped}( \\*)?$`));
}

// AccordionBox wraps its summary in a Tooltip, and the tooltip text hijacks
// the button's accessible name — so accordions are located by the visible
// h6 title inside the summary, not by button name.
function section(page: Page, title: string | RegExp): Locator {
	return dialog(page).locator('.MuiAccordion-root').filter({has: page.locator('h6', {hasText: title})});
}

async function expandSection(page: Page, title: string | RegExp): Promise<Locator> {
	const sec = section(page, title);
	const summary = sec.locator('.MuiAccordionSummary-root').first();
	if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
	return sec;
}

const BASIC = /^Basic Settings/;
const ADVANCED = /^Advanced Settings/;
const ENDPOINTS = /^Endpoints$/;
const SECONDARY = /^Secondary IPs$/;
const ALLOWED = /^Allowed Sources$/;

async function openAddDialog(page: Page): Promise<void> {
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
}

/** Rule Name + Basic Settings (protocol stays tcp unless given). */
async function fillBasics(page: Page, name: string, vip: string, port: string, opts: {portMax?: string; protocolOption?: string} = {}): Promise<void> {
	await field(page, 'Rule Name').fill(name);
	await expandSection(page, BASIC);
	if (opts.protocolOption) await selectOption(page, 'Protocol', opts.protocolOption);
	await field(page, 'External IP').fill(vip);
	await field(page, 'Port Min').fill(port);
	if (opts.portMax) await field(page, 'Port Max').fill(opts.portMax);
}

/** Adds endpoint #index (0-based) in the Endpoints section and fills it. */
async function addEndpoint(page: Page, index: number, ip: string, targetPort: string, weight?: string): Promise<void> {
	const sec = await expandSection(page, ENDPOINTS);
	await sec.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', sec).nth(index).fill(ip);
	await field(page, 'Target Port', sec).nth(index).fill(targetPort);
	if (weight !== undefined) await field(page, 'Weight', sec).nth(index).fill(weight);
}

/** Submits via Create, asserts 2xx + Success popup; returns the POST body. */
async function submitCreate(page: Page): Promise<any> {
	await page.mouse.move(0, 0); // dismiss any sticky accordion tooltip
	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
		dialogButton(page, 'Create').click(),
	]);
	const resp = await req.response();
	expect(resp?.status(), 'gateway accepted LB create').toBeLessThan(300);
	await expectSuccessAndDismiss(page);
	return req.postDataJSON();
}

async function isEventuallyDisabled(btn: Locator): Promise<boolean> {
	try {
		await expect(btn).toBeDisabled({timeout: 3000});
		return true;
	} catch {
		return false;
	}
}

/** Records LB DELETE request URLs fired while `action` runs. */
async function captureLbDeletes(page: Page, action: () => Promise<void>): Promise<string[]> {
	const urls: string[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(`${LB_PATH}/`)) urls.push(r.url());
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return urls;
}

//---------------------------------------------------------
// Suite
//---------------------------------------------------------
let instName: string;

test.describe('@loxilb LB Rule page CRUD', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await sweepLbRules();
		// dnat LB creates leave auto-generated FW allow-rules behind
		await sweepFirewallRules();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: minimal create defaults to rr/dnat, then D-single via UI', async ({page}) => {
		await openAddDialog(page);
		// 8080 is commonly reserved by OAM on production-shaped deployments.
		// Use the suite's dedicated high listener range for the LB under test.
		await fillBasics(page, 'e2e-lb-min', '203.0.113.10', '18010');
		await addEndpoint(page, 0, '198.51.100.1', '18010');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({
			name: 'e2e-lb-min',
			externalIP: '203.0.113.10',
			port: 18010,
			protocol: 'tcp',
			sel: 0, // rr default
			mode: 0, // dnat default
		});
		expect(body.endpoints).toHaveLength(1);
		expect(body.endpoints[0]).toMatchObject({endpointIP: '198.51.100.1', targetPort: 18010, weight: 1});
		// Client-side validation state must not leak into the payload.
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();
		// monitor=false ⇒ probe fields are stripped before POST.
		expect(body.serviceArguments.probetype).toBeUndefined();

		await refreshUntilRow(page, 'e2e-lb-min');

		const deletes = await captureLbDeletes(page, async () => {
			await selectRowByText(page, 'e2e-lb-min');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		// Named rules delete by name — the tuple endpoint 404s on fullproxy rules.
		expect(deletes[0]).toContain('/config/loadbalancer/name/e2e-lb-min');
		await refreshUntilGone(page, 'e2e-lb-min');
	});

	test('C-basic-range: portMax lands in the body and the range delete API is used', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-range', '203.0.113.11', '8000', {portMax: '8010'});
		await addEndpoint(page, 0, '198.51.100.2', '9000');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({port: 8000, portMax: 8010});

		await refreshUntilRow(page, 'e2e-lb-range');
		const deletes = await captureLbDeletes(page, async () => {
			await selectRowByText(page, 'e2e-lb-range');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes[0]).toContain('/config/loadbalancer/name/e2e-lb-range');
		await refreshUntilGone(page, 'e2e-lb-range');
	});

	test('C-adv-l4: each selection algorithm + onearm mode land verbatim', async ({page}) => {
		// The upstream set that works on a TCP rule. n2 (5) is loxilb-supported
		// and the UI only started offering it with the flavor work, so it gets a
		// real round-trip rather than only a dropdown presence check.
		// n3 (6) is deliberately NOT here — it is UDP-only in the datapath and
		// gets its own case below (V-n3-proto).
		const sels: Array<[string, number]> = [
			['hash', 1],
			['priority', 2],
			['persist', 3],
			['lc', 4],
			['n2', 5],
		];
		for (const [selName, selValue] of sels) {
			await openAddDialog(page);
			await fillBasics(page, `e2e-lb-${selName}`, `203.0.113.2${selValue}`, '9001');
			await expandSection(page, ADVANCED);
			await selectOption(page, 'SEL', selName);
			await addEndpoint(page, 0, '198.51.100.3', '9001');
			const body = await submitCreate(page);
			expect(body.serviceArguments.sel, `sel=${selName}`).toBe(selValue);
			await gw('DELETE', `${LB_PATH}/externalipaddress/203.0.113.2${selValue}/port/9001/protocol/tcp`);
		}

		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-onearm', '203.0.113.29', '9002');
		await expandSection(page, ADVANCED);
		await selectOption(page, 'Mode', 'onearm');
		await field(page, 'Inactive Timeout').fill('120');
		await addEndpoint(page, 0, '198.51.100.4', '9002');
		const body = await submitCreate(page);
		expect(body.serviceArguments).toMatchObject({mode: 1, inactiveTimeOut: 120});
	});

	test('C-lists: secondaryIPs[2] + allowedSources[2]', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-lists', '203.0.113.56', '8087');

		const sec2 = await expandSection(page, SECONDARY);
		await sec2.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP Address', sec2).nth(0).fill('203.0.113.111');
		await sec2.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP Address', sec2).nth(1).fill('203.0.113.112');

		const secA = await expandSection(page, ALLOWED);
		await secA.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP Address', secA).nth(0).fill('198.51.100.0/26');
		await secA.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP Address', secA).nth(1).fill('198.51.100.64/26');

		await addEndpoint(page, 0, '198.51.100.56', '8087');
		const body = await submitCreate(page);

		expect(body.secondaryIPs).toEqual([{secondaryIP: '203.0.113.111'}, {secondaryIP: '203.0.113.112'}]);
		expect(body.allowedSources).toEqual([{prefix: '198.51.100.0/26'}, {prefix: '198.51.100.64/26'}]);
	});

	test('C-multi-ep: three endpoints with distinct weights', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-multiep', '203.0.113.57', '8088');
		await addEndpoint(page, 0, '198.51.100.71', '8088', '1');
		await addEndpoint(page, 1, '198.51.100.72', '8088', '5');
		await addEndpoint(page, 2, '198.51.100.73', '8088', '10');
		const body = await submitCreate(page);

		expect(body.endpoints).toHaveLength(3);
		expect(body.endpoints.map((ep: any) => ep.weight)).toEqual([1, 5, 10]);
		await refreshUntilRow(page, 'e2e-lb-multiep');
	});

	test('V-port / V-ip: invalid port, inverted range and bad IP all block submit', async ({page}) => {
		await openAddDialog(page);
		const createBtn = dialogButton(page, 'Create');

		// Valid baseline first, then break one field at a time.
		await fillBasics(page, 'e2e-lb-v', '203.0.113.60', '8080');
		await addEndpoint(page, 0, '198.51.100.60', '8080');

		await field(page, 'Port Min').fill('0');
		expect(await isEventuallyDisabled(createBtn), 'port 0 must block').toBe(true);

		await field(page, 'Port Min').fill('8080');
		await field(page, 'Port Max').fill('100'); // min > max
		expect(await isEventuallyDisabled(createBtn), 'min>max must block').toBe(true);
		await field(page, 'Port Max').fill('');

		await field(page, 'External IP').fill('999.1.1.1');
		expect(await isEventuallyDisabled(createBtn), 'bad IP must block').toBe(true);

		await page.mouse.move(0, 0); // dismiss any sticky accordion tooltip
		await dialogButton(page, 'Cancel').click();
	});

	test('V-l7-proto: UDP + fullproxy blocks submit; switching to TCP clears it', async ({page}) => {
		// The gateway accepts a UDP fullproxy rule and programs it into the
		// TCP-only L7 sockproxy, where it dead-drops. The form blocks the combo.
		await openAddDialog(page);
		const createBtn = dialogButton(page, 'Create');
		await fillBasics(page, 'e2e-lb-l7proto', '203.0.113.62', '8081', {protocolOption: 'UDP'});
		await expandSection(page, ADVANCED);
		await selectOption(page, 'Mode', 'fullproxy');
		await addEndpoint(page, 0, '198.51.100.62', '8081');

		await expect(dialog(page).getByText(/requires? the TCP protocol/i)).toBeVisible();
		expect(await isEventuallyDisabled(createBtn), 'udp+fullproxy must block submit').toBe(true);

		// Positive: switching the protocol back to TCP clears the block.
		await expandSection(page, BASIC);
		await selectOption(page, 'Protocol', 'TCP');
		await expect(dialog(page).getByText(/requires? the TCP protocol/i)).toHaveCount(0);

		await page.mouse.move(0, 0);
		await dialogButton(page, 'Cancel').click();
	});

	test('V-dup: re-POST of an existing VIP:port/proto never duplicates the row, and the popup matches the HTTP result', async ({page, consoleGuard}) => {
		// A refusal is one of the two expected outcomes here, so its resource
		// error is not an app defect — the assertions below are what judge it.
		consoleGuard.allow(/Failed to load resource.*(400|409)/);
		// Upstream's duplicate-key behaviour is genuinely two-valued and
		// state-dependent — measured live on 0.9.8-dev:
		//   - a byte-identical re-POST of a freshly created rule  → 409
		//     {"result":"lbrule-exists error"}
		//   - a re-POST once the rule has been through one endpoint reconcile
		//     → 200, reconciling the endpoint set again
		// (The gateway, by contrast, upserts with 200 in both cases.)
		//
		// So this test deliberately does NOT pin the status code — that would
		// encode backend state, not UI behaviour. It pins the two things that
		// must hold whichever answer comes back, and the second is the one that
		// actually protects an operator: the dialog must agree with the wire. A
		// 409 rendered as "Success" is the worst outcome available here — the
		// operator believes an endpoint change landed when the rule was never
		// touched.
		await apiCreateLb({name: 'e2e-lb-dup', externalIP: '203.0.113.61', port: 8090, endpointIP: '198.51.100.61'});
		await refreshUntilRow(page, 'e2e-lb-dup');

		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-dup', '203.0.113.61', '8090');
		await addEndpoint(page, 0, '198.51.100.62', '8090');
		await page.mouse.move(0, 0); // dismiss any sticky accordion tooltip
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
			dialogButton(page, 'Create').click(),
		]);
		const status = (await req.response())?.status() ?? 0;

		if (status < 300) {
			await expectSuccessAndDismiss(page);
			// Accepted means reconciled — the new endpoint replaced the old one.
			const all = await gwJson<{lbAttr: any[]}>(`${LB_PATH}/all`);
			const rule = (all.lbAttr ?? []).find(lb => lb.serviceArguments?.externalIP === '203.0.113.61');
			expect(rule?.endpoints?.map((e: any) => e.endpointIP), 'an accepted re-POST reconciles the endpoint set').toEqual(['198.51.100.62']);
		} else {
			await expectErrorAndDismiss(page);
			// Refused means nothing changed — no partial application.
			const all = await gwJson<{lbAttr: any[]}>(`${LB_PATH}/all`);
			const rule = (all.lbAttr ?? []).find(lb => lb.serviceArguments?.externalIP === '203.0.113.61');
			expect(rule?.endpoints?.map((e: any) => e.endpointIP), 'a refused re-POST leaves the rule as it was').toEqual(['198.51.100.61']);
		}

		await refreshUntilRow(page, 'e2e-lb-dup');
		await expect(rowByText(page, '203.0.113.61'), 'a re-POST of an existing key must not duplicate the row').toHaveCount(1);
	});

	test('V-n3-proto: sel=n3 is UDP-only in the datapath — a TCP rule is refused and the refusal is surfaced', async ({page, consoleGuard}) => {
		// The 400 is the subject of the test, not a defect.
		consoleGuard.allow(/Failed to load resource.*400/);
		// n3 is the 5G N3 (GTP-U) selector. Both backends accept sel=6 through
		// swagger validation and then reject it in the datapath unless the rule
		// is UDP:
		//   400 {"result":"non-udp-n3-args error"}
		// — verified live on BOTH loxilb 0.9.8-dev and the gateway, so the same
		// case exists in tests/traffic/lb.spec.ts.
		//
		// The form offers n3 for any protocol today, so there is no client-side
		// block to assert. What must hold is that the backend's refusal reaches
		// the operator instead of a Success popup, and that a correctly-formed
		// UDP n3 rule round-trips.
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-n3tcp', '203.0.113.68', '9701');
		await expandSection(page, ADVANCED);
		await selectOption(page, 'SEL', 'n3');
		await addEndpoint(page, 0, '198.51.100.68', '9701');
		await page.mouse.move(0, 0);
		const [bad] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
			dialogButton(page, 'Create').click(),
		]);
		expect(bad.postDataJSON().serviceArguments.sel, 'the form sent n3').toBe(6);
		expect((await bad.response())?.status(), 'n3 on a TCP rule is refused by the datapath').toBe(400);
		await expectErrorAndDismiss(page);

		// The same selector on UDP is accepted — proving the refusal is about
		// the protocol pairing, not about n3 being unsupported.
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-n3udp', '203.0.113.69', '2152', {protocolOption: 'UDP'});
		await expandSection(page, ADVANCED);
		await selectOption(page, 'SEL', 'n3');
		await addEndpoint(page, 0, '198.51.100.69', '2152');
		const body = await submitCreate(page);
		expect(body.serviceArguments).toMatchObject({sel: 6, protocol: 'udp'});
		await refreshUntilRow(page, 'e2e-lb-n3udp');
	});

	test('D-multi: bulk delete fires one DELETE per selected rule', async ({page}) => {
		await apiCreateLb({name: 'e2e-lb-d1', externalIP: '203.0.113.31', port: 8081, endpointIP: '198.51.100.31'});
		await apiCreateLb({name: 'e2e-lb-d2', externalIP: '203.0.113.32', port: 8081, endpointIP: '198.51.100.32'});
		await apiCreateLb({name: 'e2e-lb-d3', externalIP: '203.0.113.33', port: 8081, endpointIP: '198.51.100.33'});

		await refreshUntilRow(page, 'e2e-lb-d1');
		await refreshUntilRow(page, 'e2e-lb-d3');

		const deletes = await captureLbDeletes(page, async () => {
			await selectRowByText(page, 'e2e-lb-d1');
			await selectRowByText(page, 'e2e-lb-d2');
			await selectRowByText(page, 'e2e-lb-d3');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes, 'one DELETE per selected LB').toHaveLength(3);
		const names = deletes.map(u => u.match(/\/name\/([^/?]+)/)?.[1]).sort();
		expect(names).toEqual(['e2e-lb-d1', 'e2e-lb-d2', 'e2e-lb-d3']);
		await refreshUntilGone(page, /e2e-lb-d[123]/);
	});
});
