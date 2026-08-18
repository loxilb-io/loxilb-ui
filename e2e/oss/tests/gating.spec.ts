//---------------------------------------------------------
// Flavor-gating assertions against a PLAIN UPSTREAM LOXILB instance
// Lives in the 'oss' Playwright project, so it is selected by testDir and
// never collected by a gateway run. Pin the loxilb registration with
// E2E_INSTANCE_LOXILB (or E2E_INSTANCE_NAME) so a mixed OAM cannot hand
// these tests a gateway.
//
// What must hold on loxilb (all live-verified against 0.9.8-dev):
// - gateway-only nav entries and routes are gated (friendly state, no /404)
// - LB form: chwbl absent (sel=8 → 422), n2/n3 present, L7 trio + mTLS +
//   AI accordion gone (silent-drop fields), e2ehttps sends 2 and round-trips
// - endpoint form: no tls-hello probe (422)
// - flavor chip identifies the instance as loxilb
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';

const LB_PATH = '/config/loadbalancer';

function field(page: Page, label: string, root?: Locator) {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return (root ?? dialog(page)).getByLabel(new RegExp(`^${escaped}( \\*)?$`));
}

function section(page: Page, title: string | RegExp): Locator {
	return dialog(page).locator('.MuiAccordion-root').filter({has: page.locator('h6', {hasText: title})});
}

async function expandSection(page: Page, title: string | RegExp): Promise<Locator> {
	const sec = section(page, title);
	const summary = sec.locator('.MuiAccordionSummary-root').first();
	if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
	return sec;
}

/**
 * The flavor chip in the breadcrumb doubles as the "flavor resolved" signal:
 * gating is permissive while the /version probe is in flight, so absence
 * assertions are only meaningful after the chip appears.
 */
async function waitForLoxilbChip(page: Page): Promise<void> {
	await expect(page.locator('#navigation .MuiChip-label', {hasText: 'loxilb'})).toBeVisible({timeout: 20_000});
}

let instName: string;

test.describe('@loxilb flavor gating — plain upstream loxilb instance', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		// Guard against a mis-pinned run: these assertions are meaningless (and
		// the suite destructive in the wrong direction) against a gateway.
		const version = await gwJson<{product?: string}>('/version');
		expect(version.product, `instance ${instName} reports a gateway product id — pin E2E_INSTANCE_NAME at the loxilb registration`).not.toBe('loxilb-inference-gateway');
		const probe = await gw('GET', '/config/trace/status');
		expect(probe.status, 'gateway-only path must 404 on plain loxilb').toBe(404);
	});

	test('nav: gateway-only groups and leaves are hidden, shared ones stay', async ({page, consoleGuard}) => {
		// The dashboard behind this navigation polls /status/* — loxilb's
		// /status/device occasionally 500s transiently (shell-exec based;
		// 200 on re-probe). The cards degrade in-page; that noise is not a
		// nav-gating failure.
		consoleGuard.allow(/Failed to load resource.*50\d/i);
		// domcontentloaded: the dashboard's 1s polling keeps the load event
		// from settling over a WAN link; the chip wait below is the real gate.
		await page.goto(`instance/dashboard?name=${instName}`, {waitUntil: 'domcontentloaded'});
		await waitForLoxilbChip(page);

		const menu = page.locator('.MuiDrawer-paper');
		// Shared groups survive.
		for (const group of ['Traffic', 'Networks', 'Status']) {
			await expect(menu.getByText(group, {exact: true}), `${group} group`).toBeVisible();
		}
		// Gateway-only groups collapse away entirely (AI Gateway, IPsec VPN,
		// Security via both children gated, Maintenance via Snapshots).
		for (const group of ['AI Gateway', 'IPsec VPN', 'Security', 'Maintenance']) {
			await expect(menu.getByText(group, {exact: true}), `${group} group`).toHaveCount(0);
		}
		// Leaves inside mixed groups.
		await menu.getByText('Traffic', {exact: true}).click();
		await expect(menu.getByText('LB Rule', {exact: true})).toBeVisible();
		await expect(menu.getByText('SNI Certificates', {exact: true})).toHaveCount(0);
		await menu.getByText('Networks', {exact: true}).click();
		await expect(menu.getByText('IP Address', {exact: true})).toBeVisible();
		await expect(menu.getByText('IPv6 Address', {exact: true})).toHaveCount(0);
	});

	test('route: direct hit on a gated page shows the friendly state, not /404 or an error banner', async ({page, consoleGuard}) => {
		// A direct hit mounts the page during the permissive pre-resolution
		// window, so its read queries 404 on loxilb before the gate replaces
		// the page — Chrome logs those. Degrading in-page is the assertion
		// below; the resource-error noise is expected.
		consoleGuard.allow(/Failed to load resource/i);
		for (const route of ['ai/apikey', 'ipsec/tunnels', 'security/ipfilter', 'network/ip6', 'maintenance/snapshots', 'traffic/sni-certs']) {
			await page.goto(`instance/${route}?name=${instName}`, {waitUntil: 'domcontentloaded'});
			await waitForLoxilbChip(page);
			await expect(page.getByText('Not available on this instance'), route).toBeVisible({timeout: 15_000});
			expect(page.url(), `${route} must keep its URL`).not.toContain('/404');
			await expect(page.locator('.MuiAlert-standardError'), `${route} must not show an error banner`).toHaveCount(0);
		}
	});

	test('LB form: chwbl/L7/mTLS/AI gone, n2+n3 and e2ehttps offered', async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await waitForLoxilbChip(page);
		await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
		await expandSection(page, /^Advanced Settings/);

		// SEL options: shared set incl. the newly exposed n2/n3, no chwbl.
		await field(page, 'SEL').click();
		const selOptions = await page.getByRole('option').allTextContents();
		expect(selOptions).toEqual(expect.arrayContaining(['rr', 'hash', 'n2', 'n3']));
		expect(selOptions).not.toContain('chwbl');
		await page.keyboard.press('Escape');

		// Security options: the corrected 0/1/2 list, e2ehttps included.
		await selectOption(page, 'Mode', 'fullproxy');
		await field(page, 'Security').click();
		const secOptions = await page.getByRole('option').allTextContents();
		expect(secOptions).toEqual(expect.arrayContaining(['Plain', 'https', 'e2ehttps']));
		expect(secOptions).not.toContain('tls');
		await page.keyboard.press('Escape');

		// Gateway-only controls are gone: L7 trio, frontend mTLS, AI accordion.
		for (const label of ['Path Match Mode', 'Path Prefix', 'Backend Protocol', 'Client Cert Mode']) {
			await expect(field(page, label), label).toHaveCount(0);
		}
		await expect(section(page, /^AI Gateway/), 'AI Gateway accordion').toHaveCount(0);
		// Host is a shared upstream field and must survive the gating.
		await expect(field(page, 'Host')).toHaveCount(1);
		await dialogButton(page, 'Cancel').click();
	});

	test('LB round-trip: n2 + fullproxy + e2ehttps(2) accepted and echoed by loxilb', async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await waitForLoxilbChip(page);
		await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');

		await field(page, 'Rule Name').fill('e2e-lb-flavor');
		await expandSection(page, /^Basic Settings/);
		await field(page, 'External IP').fill('203.0.113.80');
		await field(page, 'Port Min').fill('9443');
		await expandSection(page, /^Advanced Settings/);
		await selectOption(page, 'SEL', 'n2');
		await selectOption(page, 'Mode', 'fullproxy');
		await selectOption(page, 'Security', 'e2ehttps');
		const endpoints = await expandSection(page, /^Endpoints$/);
		await endpoints.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', endpoints).first().fill('198.51.100.80');
		await field(page, 'Target Port', endpoints).first().fill('9443');

		await page.mouse.move(0, 0);
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
			dialogButton(page, 'Create').click(),
		]);
		const resp = await req.response();
		expect(resp?.status(), 'loxilb accepted the create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		// The wire value is the whole point: e2ehttps must be 2 (3 is the old
		// silent-plaintext bug on the gateway and a hard 422 here).
		const body = req.postDataJSON();
		expect(body.serviceArguments).toMatchObject({sel: 5, mode: 4, security: 2});

		const all = await gwJson<{lbAttr: any[]}>(`${LB_PATH}/all`);
		const created = (all.lbAttr ?? []).find(lb => lb.serviceArguments?.port === 9443 && lb.serviceArguments?.externalIP === '203.0.113.80');
		expect(created, 'created rule visible on REST read-back').toBeTruthy();
		expect(created!.serviceArguments).toMatchObject({sel: 5, security: 2});
	});

	test.afterEach(async () => {
		await sweepLbRules();
		await sweepFirewallRules();
	});

	// loxilb counterpart of lb.spec.ts '@gw C-probe': upstream LB-level probes
	// are connect-only (http/https → 400 "malformed-service-ptype"), so the
	// options are gone and a tcp probe must round-trip.
	test('LB probe on loxilb: connect probes only, tcp probe round-trips', async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await waitForLoxilbChip(page);
		await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');

		await field(page, 'Rule Name').fill('e2e-lb-probe-lx');
		await expandSection(page, /^Basic Settings/);
		await field(page, 'External IP').fill('203.0.113.81');
		await field(page, 'Port Min').fill('9086');
		await expandSection(page, /^Advanced Settings/);
		await field(page, 'Enable Monitor').check();
		const sec = await expandSection(page, /^Endpoints$/);

		await field(page, 'Probe Type', sec).click();
		const probeOptions = await page.getByRole('option').allTextContents();
		expect(probeOptions).toEqual(expect.arrayContaining(['PING', 'TCP', 'UDP']));
		expect(probeOptions).not.toContain('HTTP');
		expect(probeOptions).not.toContain('HTTPS');
		await page.getByRole('option', {name: 'TCP', exact: true}).click();
		await field(page, 'Probe Port', sec).fill('9086');

		await sec.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', sec).nth(0).fill('198.51.100.81');
		await field(page, 'Target Port', sec).nth(0).fill('9086');

		await page.mouse.move(0, 0);
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
			dialogButton(page, 'Create').click(),
		]);
		const resp = await req.response();
		expect(resp?.status(), 'loxilb accepted the tcp-probe create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		expect(req.postDataJSON().serviceArguments).toMatchObject({monitor: true, probetype: 'tcp', probeport: 9086});
	});

	// loxilb counterpart of lb.spec.ts '@gw E-patch'. Upstream has NO in-place
	// serviceArguments update: the per-VIP PATCH is gateway-only (405 here) and
	// a re-POST reconciles ONLY the endpoint set — any other change 409s with
	// "lbrule-exists" (verified live, even for an identical body). So the UI
	// must delete + re-create for serviceArguments edits and may re-POST for
	// endpoint-only edits. Both paths are asserted, including that the rule
	// actually carries the new values on REST read-back afterwards.
	test('LB edit on loxilb: delete+recreate for sa changes, native reconcile for endpoint-only', async ({page}) => {
		const create = await gw('POST', LB_PATH, {
			serviceArguments: {name: 'e2e-lb-edit-lx', externalIP: '203.0.113.82', port: 9087, protocol: 'tcp', sel: 0, mode: 0},
			endpoints: [{endpointIP: '198.51.100.82', targetPort: 9087, weight: 1}],
		});
		expect(create.status, 'API seed create').toBeLessThan(300);

		await page.goto(`instance/traffic/lb?name=${instName}`);
		await waitForLoxilbChip(page);

		const editSelected = async () => {
			const row = page.getByRole('row').filter({hasText: 'e2e-lb-edit-lx'});
			await expect(row).toBeVisible({timeout: 20_000});
			const box = row.getByRole('checkbox');
			if (!(await box.isChecked())) await box.check();
			await openToolbarDialog(page, 'Mode', 'Edit Load Balancer Rule');
		};
		const captureMutations = () => {
			const calls: string[] = [];
			const listener = (r: any) => {
				if (['POST', 'PATCH', 'DELETE'].includes(r.method()) && r.url().includes(LB_PATH)) calls.push(r.method());
			};
			page.on('request', listener);
			return {calls, stop: () => page.off('request', listener)};
		};

		// (a) serviceArguments change → DELETE + POST, never PATCH.
		await editSelected();
		await expandSection(page, /^Advanced Settings/);
		await field(page, 'Inactive Timeout').fill('120');
		await page.mouse.move(0, 0);
		let cap = captureMutations();
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
			dialogButton(page, 'Update').click(),
		]);
		expect((await req.response())?.status(), 'loxilb accepted the re-create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		cap.stop();
		expect(cap.calls, 'sa change = delete then re-create').toEqual(['DELETE', 'POST']);

		let all = await gwJson<{lbAttr: any[]}>(`${LB_PATH}/all`);
		let rule = (all.lbAttr ?? []).find(lb => lb.serviceArguments?.port === 9087);
		expect(rule?.serviceArguments?.inactiveTimeOut, 'sa edit applied on read-back').toBe(120);

		// (b) endpoint-weight-only change → single POST (native reconcile).
		await page.reload({waitUntil: 'domcontentloaded'});
		await waitForLoxilbChip(page);
		await editSelected();
		const sec = await expandSection(page, /^Endpoints$/);
		await field(page, 'Weight', sec).nth(0).fill('7');
		await page.mouse.move(0, 0);
		cap = captureMutations();
		const [req2] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(LB_PATH)),
			dialogButton(page, 'Update').click(),
		]);
		expect((await req2.response())?.status(), 'loxilb reconciled the endpoint set').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		cap.stop();
		expect(cap.calls, 'endpoint-only change = plain re-POST reconcile').toEqual(['POST']);
		// The reconcile body must carry the CURRENT rule state — a stale form
		// here silently rewrites unrelated serviceArguments on the backend.
		expect(req2.postDataJSON().serviceArguments.inactiveTimeOut, 'reconcile body carries the fresh timeout').toBe(120);

		all = await gwJson<{lbAttr: any[]}>(`${LB_PATH}/all`);
		rule = (all.lbAttr ?? []).find(lb => lb.serviceArguments?.port === 9087);
		expect(rule?.endpoints?.[0]?.weight, 'weight applied on read-back').toBe(7);
		expect(rule?.serviceArguments?.inactiveTimeOut, 'earlier sa edit survived').toBe(120);
	});

	test('endpoint form: tls-hello probe option is absent', async ({page}) => {
		await page.goto(`instance/traffic/endpoint?name=${instName}`);
		await waitForLoxilbChip(page);
		await openToolbarDialog(page, 'Add', dialog(page));

		await field(page, 'Probe Type').click();
		const probeOptions = await page.getByRole('option').allTextContents();
		expect(probeOptions).toEqual(expect.arrayContaining(['PING', 'TCP', 'HTTPS', 'NONE']));
		expect(probeOptions).not.toContain('TLS-HELLO');
		await page.keyboard.press('Escape');
		await dialogButton(page, 'Cancel').click();
	});

	test('instance card and breadcrumb identify the flavor', async ({page}) => {
		await page.goto('instance');
		const card = page.locator('.MuiCard-root').filter({hasText: instName});
		await expect(card.locator('.MuiChip-label', {hasText: 'loxilb'})).toBeVisible({timeout: 20_000});
	});
});
