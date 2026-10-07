//---------------------------------------------------------
// LB create form — source-check slot budget (SRC-E2E-01..05), mock contract.
//---------------------------------------------------------
// Only the first 29 LB rule slots can carry allowedSources, and the gateway
// reports the budget as the `lb_allowed_sources` capability: `ready` = the NEXT
// rule created can carry them, `limit`/`in_use` = the budget. The create form
// shows the free slots, and warns with the gateway's own sentence when the next
// rule cannot — a warning only: the verdict is a cached read, and the 412 stays
// the authority. An edit never uses it (the verdict is not about that rule's
// slot), and the budget is re-asked after every LB write.
//
// ⭐ Intercepted: the capability read, the rule list and the LB writes.
// /version and /meta stay real, so the flavor gate is exercised.
import type {Page, Request, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {CAP_LB_ALLOWED_SOURCES, mockCapabilities, mockCapabilitiesSequence} from '../../helpers/capabilities';
import {dialog, dialogButton, openToolbarDialog} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {selectRowByText} from '../../helpers/table';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_WRITE_RE = /\/netlox\/v1\/config\/loadbalancer(\/(?!all)[^?]*)?(\?.*)?$/;

// The gateway's own sentence (common/lb_source_check_precondition.go). Asserted
// verbatim: a paraphrase in the UI is a regression.
const GW_SENTENCE =
	'source checks (allowedSources) can be carried by at most 29 load-balancer rules (rule slots 0-28) and all 29 of those slots are held by existing rules; this rule was allocated slot 31. Delete a load-balancer rule holding a lower slot and create this one again -- freed slots are reused first';

const SOURCE = '198.51.100.0/26';
const L4_RULE = {
	serviceArguments: {name: 'e2e-src-l4', externalIP: '192.0.2.71', port: 18071, protocol: 'tcp', sel: 0, mode: 0, inactiveTimeOut: 30},
	endpoints: [{endpointIP: '198.51.100.71', targetPort: 18071, weight: 1, state: 'active'}],
	secondaryIPs: null,
	allowedSources: null,
};

const ready = (inUse: number) => ({capabilities: [{name: CAP_LB_ALLOWED_SOURCES, ready: true, limit: 29, in_use: inUse}]});
const exhausted = {
	capabilities: [{name: CAP_LB_ALLOWED_SOURCES, ready: false, reason_code: 'LB_SOURCE_CHECK_SLOTS_EXHAUSTED', reason: GW_SENTENCE, limit: 29, in_use: 29}],
};

let instName: string;

async function mockRuleList(page: Page, rules: unknown[] = []): Promise<void> {
	await page.route(LB_ALL_RE, (route: Route) =>
		route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: rules})}),
	);
}

async function recordWrites(page: Page, status = 200, body: unknown = {code: 200, result: 'Success'}): Promise<Request[]> {
	const writes: Request[] = [];
	await page.route(LB_WRITE_RE, (route: Route) => {
		writes.push(route.request());
		return route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
	});
	return writes;
}

/** Open Add, fill a minimal L4 rule, and open Allowed Sources. */
async function openAddL4(page: Page, name = 'e2e-src-new') {
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	await field(page, 'Rule Name').fill(name);
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.72');
	await field(page, 'Port Min').fill('18072');
	const eps = await expandSection(page, /^Endpoints$/);
	await eps.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', eps).first().fill('198.51.100.72');
	await field(page, 'Target Port', eps).first().fill('18072');
	return expandSection(page, /^Allowed Sources$/);
}

async function addSource(sources: ReturnType<typeof dialog>, page: Page) {
	await sources.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP Address', sources).first().fill(SOURCE);
}

test.describe('@gw LB source-check slot budget — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('SRC-E2E-01: ready with a budget shows the free slots and no warning', async ({page}) => {
		await mockCapabilities(page, {body: ready(20)});
		await mockRuleList(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const sources = await openAddL4(page);
		await expect(sources.getByText('9 of 29 source-check slots free')).toBeVisible();
		await expect(sources.getByRole('alert')).toHaveCount(0);
	});

	test('SRC-E2E-02: exhausted warns with the gateway sentence, submit stays enabled, and the 412 keeps the form', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 412, path: /\/config\/loadbalancer$/});
		await mockCapabilities(page, {body: exhausted});
		await mockRuleList(page);
		const writes = await recordWrites(page, 412, {code: 412, message: 'Server precondition not met for API call', result: GW_SENTENCE});
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const sources = await openAddL4(page);
		// Nothing asks for a slot yet: no warning.
		await expect(sources.getByRole('alert')).toHaveCount(0);
		await addSource(sources, page);
		await expect(sources.getByRole('alert')).toContainText(GW_SENTENCE);
		await expect(dialogButton(page, 'Create')).toBeEnabled();

		await dialogButton(page, 'Create').click();
		await expect(page.getByText(/its deployment must change/)).toBeVisible({timeout: 20_000});
		expect(writes.map(r => r.method())).toEqual(['POST']);
		expect(writes[0].postDataJSON().allowedSources).toEqual([{prefix: SOURCE}]);

		// A precondition refusal keeps the operator's draft.
		const errorHeading = page.getByRole('heading', {name: 'Error'});
		await page.locator('.MuiModal-root').filter({has: errorHeading}).last().getByRole('button', {name: 'OK', exact: true}).click();
		await expect(field(page, 'Rule Name')).toHaveValue('e2e-src-new');
	});

	test('SRC-E2E-03: an older gateway (404) or an unlisted capability says nothing and submits as before', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 404, path: /\/status\/capabilities$/});
		await mockCapabilities(page, {status: 404});
		await mockRuleList(page);
		const writes = await recordWrites(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const sources = await openAddL4(page);
		await addSource(sources, page);
		await expect(sources.getByText(/source-check slots free/)).toHaveCount(0);
		await expect(sources.getByRole('alert')).toHaveCount(0);
		await dialogButton(page, 'Create').click();
		await expect.poll(() => writes.length).toBe(1);
		expect(writes[0].postDataJSON().allowedSources).toEqual([{prefix: SOURCE}]);
	});

	test('SRC-E2E-03b: a gateway that does not list the capability says nothing', async ({page}) => {
		await mockCapabilities(page, {body: {capabilities: [{name: 'kv_exact_vllm', ready: true}]}});
		await mockRuleList(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const sources = await openAddL4(page);
		await addSource(sources, page);
		await expect(sources.getByText(/source-check slots free/)).toHaveCount(0);
		await expect(sources.getByRole('alert')).toHaveCount(0);
		await expect(dialogButton(page, 'Create')).toBeEnabled();
	});

	test('SRC-E2E-04: an edit shows no budget and no warning, even when exhausted, and the PATCH is sent', async ({page}) => {
		await mockCapabilities(page, {body: exhausted});
		await mockRuleList(page, [L4_RULE]);
		const writes = await recordWrites(page);
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await selectRowByText(page, 'e2e-src-l4');
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		const sources = await expandSection(page, /^Allowed Sources$/);
		await addSource(sources, page);
		await expect(sources.getByText(/source-check slots free/)).toHaveCount(0);
		await expect(sources.getByRole('alert')).toHaveCount(0);
		// (The capability list may still be read here: the AI Gateway section's
		// KV-exact check shares it. What must not happen is the budget being
		// applied to an edit: the verdict is about the next slot, not this rule's.)
		await dialogButton(page, 'Update').click();
		await expect.poll(() => writes.length).toBe(1);
		expect(writes[0].method()).toBe('PATCH');
	});

	test('SRC-E2E-05: after a confirmed create, reopening Add shows the re-asked budget', async ({page}) => {
		const caps = await mockCapabilitiesSequence(page, [ready(20), ready(21)]);
		// The create is confirmed by the rule reading back with the values that
		// were sent, so the list serves what the POST carried — the way a
		// gateway that stored it would.
		let created: unknown = null;
		await page.route(LB_ALL_RE, (route: Route) =>
			route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: created ? [created] : []})}),
		);
		await page.route(LB_WRITE_RE, (route: Route) => {
			created = route.request().postDataJSON();
			return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({code: 200, result: 'Success'})});
		});
		await page.goto(`instance/traffic/lb?name=${instName}`);
		const sources = await openAddL4(page);
		await expect(sources.getByText('9 of 29 source-check slots free')).toBeVisible();
		await addSource(sources, page);
		await dialogButton(page, 'Create').click();
		await expect(page.getByText('Added successfully.')).toBeVisible({timeout: 20_000});
		await page.getByRole('button', {name: 'OK', exact: true}).click();

		// Well inside the read's 5 s staleTime: only an invalidation re-asks.
		const sources2 = await openAddL4(page, 'e2e-src-second');
		await expect(sources2.getByText('8 of 29 source-check slots free')).toBeVisible();
		expect(caps.count()).toBeGreaterThanOrEqual(2);
	});
});
