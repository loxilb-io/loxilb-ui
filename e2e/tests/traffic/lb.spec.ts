//---------------------------------------------------------
// LB Rule page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §1.1).
// POST/PATCH/DELETE /config/loadbalancer*, payload
// IServiceConfiguration. Entities use e2e- names + reserved
// documentation IPs. dnat creates spawn gateway FW allow-rules
// that survive LB delete — the firewall sweep covers those.
//
// Not exercisable via the UI (documented gaps, not regressions):
// - privateIP (fullnat helper) — field commented out of the form
// - security / proxyprotocolv2 / block — fields commented out
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
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
const AIGW = /^AI Gateway/;
const ENDPOINTS = /^Endpoints$/;
const SECONDARY = /^Secondary IPs$/;
const ALLOWED = /^Allowed Sources$/;

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('Add Load Balancer Rule')).toBeVisible();
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

/**
 * Fill a ParamBox whose control type depends on gateway metadata: a field
 * with an enum renders as a Select (combobox), otherwise as a textbox.
 */
async function setField(page: Page, label: string, value: string, root?: Locator): Promise<void> {
	const f = field(page, label, root);
	if ((await f.getAttribute('role')) === 'combobox') {
		await f.click();
		await page.getByRole('option', {name: value, exact: true}).click();
	} else {
		await f.fill(value);
	}
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

test.describe('LB Rule page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
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
		await fillBasics(page, 'e2e-lb-min', '203.0.113.10', '8080');
		await addEndpoint(page, 0, '198.51.100.1', '8080');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({
			name: 'e2e-lb-min',
			externalIP: '203.0.113.10',
			port: 8080,
			protocol: 'tcp',
			sel: 0, // rr default
			mode: 0, // dnat default
		});
		expect(body.endpoints).toHaveLength(1);
		expect(body.endpoints[0]).toMatchObject({endpointIP: '198.51.100.1', targetPort: 8080, weight: 1});
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
		const sels: Array<[string, number]> = [
			['hash', 1],
			['priority', 2],
			['persist', 3],
			['lc', 4],
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

	test('C-adv-l7: fullproxy + host/path/backend-protocol/llm-type', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-l7', '203.0.113.50', '8443');
		await expandSection(page, ADVANCED);
		await selectOption(page, 'Mode', 'fullproxy');
		await field(page, 'Host').fill('e2e.example.com');
		await selectOption(page, 'Path Match Mode', 'prefix');
		await field(page, 'Path Prefix').fill('/v1/chat');
		await selectOption(page, 'Backend Protocol', 'http1');
		await addEndpoint(page, 0, '198.51.100.50', '8443');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({
			mode: 4,
			host: 'e2e.example.com',
			path_match_mode: 'prefix',
			path_prefix: '/v1/chat',
			backend_protocol: 'http1'
		});
		await refreshUntilRow(page, 'e2e-lb-l7');
	});

	test('C-aigw-stream: SSE streaming fields land verbatim', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-sse', '203.0.113.51', '8444');
		await expandSection(page, ADVANCED);
		await selectOption(page, 'Mode', 'fullproxy');
		await expandSection(page, AIGW);
		await field(page, 'Model Name').fill('e2e-model');
		await field(page, 'Trace Type').fill('v1');
		await field(page, 'Session Header Name').fill('X-E2E-Session');
		await field(page, 'SSE Mode').check();
		await field(page, 'Max Stream Duration (s)').fill('600');
		await field(page, 'Backend Keepalive Interval (s)').fill('30');
		await addEndpoint(page, 0, '198.51.100.51', '8444');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({
			model_name: 'e2e-model',
			trace_type: 'v1',
			session_header_name: 'X-E2E-Session',
			sse_mode: true,
			max_stream_duration_sec: 600,
			backend_keepalive_interval_sec: 30,
		});
	});

	test('C-aigw-pd: prefill/decode disaggregation incl. per-endpoint roles', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-pd', '203.0.113.52', '8445');
		await expandSection(page, ADVANCED);
		await selectOption(page, 'Mode', 'fullproxy');
		await expandSection(page, AIGW);
		await field(page, 'P/D Disaggregation Mode').check();
		await field(page, 'P/D Cache-Aware Mode').check();
		await field(page, 'P/D Session TTL (s)').fill('60');
		await field(page, 'P/D Cache Threshold').fill('50');
		await field(page, 'P/D Balance Abs Threshold').fill('4');

		const sec = await expandSection(page, ENDPOINTS);
		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).nth(0).fill('198.51.100.61');
		await field(page, 'Target Port', sec).nth(0).fill('9000');
		await selectOption(page, 'EP Role', 'prefill', 0);
		await field(page, 'NIXL Port', sec).nth(0).fill('5601');
		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).nth(1).fill('198.51.100.62');
		await field(page, 'Target Port', sec).nth(1).fill('9000');
		await selectOption(page, 'EP Role', 'decode', 1);
		await field(page, 'NIXL Port', sec).nth(1).fill('5602');

		const body = await submitCreate(page);
		expect(body.serviceArguments).toMatchObject({
			pd_disagg_mode: true,
			pd_cache_aware_mode: true,
			pd_session_ttl_sec: 60,
			pd_cache_threshold: 50,
			pd_balance_abs_threshold: 4,
		});
		expect(body.endpoints).toHaveLength(2);
		expect(body.endpoints[0]).toMatchObject({endpointIP: '198.51.100.61', ep_role: 1, nixl_port: 5601});
		expect(body.endpoints[1]).toMatchObject({endpointIP: '198.51.100.62', ep_role: 2, nixl_port: 5602});
	});

	test('C-aigw-kv: CHWBL sel + KV-cache routing fields (boundary values)', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-kv', '203.0.113.53', '8446');
		await expandSection(page, ADVANCED);
		await selectOption(page, 'Mode', 'fullproxy');
		await selectOption(page, 'SEL', 'chwbl');
		await expandSection(page, AIGW);
		await setField(page, 'CHWBL Prefix Hash Level', '2');
		await setField(page, 'CHWBL Prefix Hash Flags', '1');
		await setField(page, 'KV Exact Mode', '1');
		await setField(page, 'KV Block Size', '1'); // boundary
		await selectOption(page, 'KV Hash Algo', 'xxhash_cbor');
		await setField(page, 'KV ZMQ Port', '65535'); // boundary
		await addEndpoint(page, 0, '198.51.100.53', '8446');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({
			sel: 8,
			chwbl_prefix_hash_level: 2,
			chwbl_prefix_hash_flags: 1,
			kvExactMode: 1,
			kvBlockSize: 1,
			kvHashAlgo: 'xxhash_cbor',
			kvZmqPort: 65535,
		});
	});

	test('C-probe: monitor + http probe fields land; stripped when monitor off (C-min)', async ({page}) => {
		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-probe', '203.0.113.55', '8086');
		await expandSection(page, ADVANCED);
		await field(page, 'Enable Monitor').check();
		const sec = await expandSection(page, ENDPOINTS);
		await selectOption(page, 'Probe Type', 'HTTP');
		await field(page, 'Probe Port', sec).fill('8086');
		await field(page, 'Probe Request', sec).fill('/health');
		await field(page, 'Probe Response', sec).fill('OK');
		await field(page, 'Probe Timeout', sec).fill('5');
		await field(page, 'Probe Retries', sec).fill('2');
		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).nth(0).fill('198.51.100.55');
		await field(page, 'Target Port', sec).nth(0).fill('8086');
		const body = await submitCreate(page);

		expect(body.serviceArguments).toMatchObject({
			monitor: true,
			probetype: 'http',
			probeport: 8086,
			probereq: '/health',
			proberesp: 'OK',
			probeTimeout: 5,
			probeRetries: 2,
		});
		await refreshUntilRow(page, 'e2e-lb-probe');
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

	test('V-dup: re-POST of an existing VIP:port/proto upserts — no duplicate row, no crash', async ({page}) => {
		// Observed gateway semantics (2026-07-19): POST /config/loadbalancer with
		// an existing externalIP:port/protocol key returns 200 and REPLACES the
		// rule (upsert) instead of rejecting with 4xx as the plan assumed. The
		// UI must end up with exactly one row for the key either way.
		await apiCreateLb({name: 'e2e-lb-dup', externalIP: '203.0.113.61', port: 8090, endpointIP: '198.51.100.61'});
		await refreshUntilRow(page, 'e2e-lb-dup');

		await openAddDialog(page);
		await fillBasics(page, 'e2e-lb-dup', '203.0.113.61', '8090');
		await addEndpoint(page, 0, '198.51.100.62', '8090');
		const body = await submitCreate(page); // 200 = upsert accepted
		expect(body.serviceArguments.externalIP).toBe('203.0.113.61');

		await refreshUntilRow(page, 'e2e-lb-dup');
		await expect(rowByText(page, '203.0.113.61'), 'upsert must not duplicate the row').toHaveCount(1);
	});

	test('E-patch + E-immutable: edit sends a merge-patch of changed keys only', async ({page}) => {
		await apiCreateLb({name: 'e2e-lb-edit', externalIP: '203.0.113.40', port: 8085, endpointIP: '198.51.100.5'});
		await refreshUntilRow(page, 'e2e-lb-edit');

		await selectRowByText(page, 'e2e-lb-edit');
		await toolbarButton(page, 'Mode').click(); // edit (pencil)
		await expect(dialog(page).getByText('Edit Load Balancer Rule')).toBeVisible();

		// E-immutable: composite key + name are disabled in edit mode.
		await expect(field(page, 'Rule Name')).toBeDisabled();
		await expandSection(page, BASIC);
		await expect(field(page, 'External IP')).toBeDisabled();
		await expect(field(page, 'Port Min')).toBeDisabled();

		// Mutable edits: inactiveTimeOut + endpoint weight.
		await expandSection(page, ADVANCED);
		await field(page, 'Inactive Timeout').fill('120');
		const sec = await expandSection(page, ENDPOINTS);
		await field(page, 'Weight', sec).nth(0).fill('7');

		await page.mouse.move(0, 0); // dismiss any sticky accordion tooltip
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'PATCH' && r.url().includes(`${LB_PATH}/externalipaddress`)),
			dialogButton(page, 'Update').click(),
		]);
		expect(req.url()).toContain('/externalipaddress/203.0.113.40/port/8085/protocol/tcp');
		const patch = req.postDataJSON();

		// RFC 7386: changed keys present, immutable keys absent.
		expect(patch.serviceArguments?.inactiveTimeOut).toBe(120);
		for (const immutable of ['externalIP', 'port', 'protocol', 'mode', 'name']) {
			expect(patch.serviceArguments?.[immutable], `immutable key ${immutable} must not be patched`).toBeUndefined();
		}
		expect(patch.endpoints?.[0]).toMatchObject({endpointIP: '198.51.100.5', weight: 7});

		const status = (await req.response())?.status() ?? 0;
		expect(status, 'gateway accepted the merge-patch').toBeLessThan(300);
		await expect(dialog(page).getByText('Load balancer rule updated successfully.')).toBeVisible();
		await dialogButton(page, 'OK').click();
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
