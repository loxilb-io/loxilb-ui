//---------------------------------------------------------
// Changing an existing fullproxy rule on the gateway — mock contract layer
// (FPR-E2E-01..06).
//---------------------------------------------------------
// The gateway changes a fullproxy rule through one write: a POST of the whole
// rule on the same identity. These cases pin what the page sends, what it asks
// before sending, and what it says when the gateway does not take the change.
//
// ⚠️ MOCKED on purpose. The outcomes that matter most here — a refused
// re-creation, a 409 for "nothing changed", a rule that vanished between the
// list read and the edit — cannot be produced on demand on a live gateway.
// Only the rule list and the LB writes are intercepted; `/version` and `/meta`
// stay real, so the flavor gate that chooses the replace is exercised.
//
// ⚠️ The mocked list is MUTABLE and the POST handler writes into it. A case
// that expects a confirmed write therefore passes only if the body the page
// sent carries the values it then reads back.
//---------------------------------------------------------
import type {Page, Request, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {mockKvExactReady} from '../../helpers/capabilities';
import {dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {selectRowByText} from '../../helpers/table';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_WRITE_RE = /\/netlox\/v1\/config\/loadbalancer(\/(?!all)[^?]*)?(\?.*)?$/;

const RULE = 'e2e-fpr-rule';
const SIBLING = 'e2e-fpr-sibling';
const VIP = '192.0.2.81';
const PORT = 18081;

type Rule = {serviceArguments: Record<string, unknown>; endpoints: Record<string, unknown>[]; secondaryIPs: null; allowedSources: {prefix: string}[] | null};

/** A stored fullproxy rule, with the observations a read carries and a write must not. */
function rule(over: Record<string, unknown> = {}): Rule {
	return {
		serviceArguments: {
			id: 'fpr-1', name: RULE, externalIP: VIP, port: PORT, protocol: 'tcp', sel: 0, mode: 4,
			host: 'a.example', sse_mode: true, max_stream_duration_sec: 600,
			fc_mode: 'observe', fc_max_outstanding: 64,
			fc_effective: {mode: 'observe', max_outstanding: 64, inflight: 2, queued: 0},
			half_close_effective: {mode: 'off', source: 'default'},
			...over,
		},
		endpoints: [{endpointIP: '198.51.100.81', targetPort: 9001, weight: 1, state: 'active', counter: '0:0'}],
		secondaryIPs: null,
		allowedSources: [{prefix: '10.9.0.0/16'}],
	};
}

/** Same VIP and port, another host: a different rule that no edit of RULE may touch. */
const sibling = (): Rule => rule({id: 'fpr-2', name: SIBLING, host: 'b.example', max_stream_duration_sec: 111});

interface Server {
	rules: Rule[];
	/** What the next POST answers. `store` writes the body into `rules` first. */
	answer: {status: number; body: unknown; store: boolean};
	/** The rule is gone from the list once the next POST has been answered. */
	dropOnWrite: boolean;
	writes: Request[];
	listReads: number;
}

const OK = {status: 200, body: {code: 200, result: 'Success'}, store: true};

async function serve(page: Page, rules: Rule[]): Promise<Server> {
	const server: Server = {rules, answer: OK, dropOnWrite: false, writes: [], listReads: 0};
	await page.route(LB_ALL_RE, (route: Route) => {
		server.listReads++;
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: server.rules})});
	});
	await page.route(LB_WRITE_RE, (route: Route) => {
		const request = route.request();
		server.writes.push(request);
		if (request.method() === 'POST' && server.answer.store) {
			const body = request.postDataJSON() as Rule;
			const at = server.rules.findIndex(r => r.serviceArguments.name === body.serviceArguments.name);
			// The stored rule keeps its id; the request does not carry one.
			const stored = {...body, serviceArguments: {...body.serviceArguments, id: at >= 0 ? server.rules[at].serviceArguments.id : 'fpr-new'}};
			if (at >= 0) server.rules[at] = stored;
			else server.rules.push(stored);
		}
		if (request.method() === 'POST' && server.dropOnWrite) server.rules.length = 0;
		return route.fulfill({status: server.answer.status, contentType: 'application/json', body: JSON.stringify(server.answer.body)});
	});
	return server;
}

let instName: string;

async function openEdit(page: Page, name = RULE): Promise<void> {
	await page.goto(`instance/traffic/lb?name=${instName}`);
	await selectRowByText(page, name);
	await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
}

/** An admission field: the gateway applies it to the running listener. */
async function changeMaxOutstanding(page: Page, value: string): Promise<void> {
	const aigw = await expandSection(page, /^AI Gateway/);
	const toggle = aigw.getByRole('button', {name: 'Admission Control'});
	if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
	await field(page, 'Max Outstanding', aigw).fill(value);
}

/** An endpoint: the gateway re-creates the listener for it. */
async function changeEndpointPort(page: Page, value: string): Promise<void> {
	const eps = await expandSection(page, /^Endpoints$/);
	await field(page, 'Target Port', eps).first().fill(value);
}

const posts = (server: Server): Request[] => server.writes.filter(request => request.method() === 'POST');

test.describe('@gw Fullproxy rule replace — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await mockKvExactReady(page);
	});

	test('FPR-E2E-01: an admission change is sent as one whole-rule POST, with no re-creation prompt', async ({page}) => {
		const server = await serve(page, [rule(), sibling()]);
		await openEdit(page);
		await changeMaxOutstanding(page, '32');
		await dialogButton(page, 'Update').click();

		await expect(page.getByText('Load balancer rule updated successfully.')).toBeVisible({timeout: 20_000});
		await expect(page.getByText(/removing the listener/)).toHaveCount(0);

		// One write, and it is the POST: never the tuple PATCH, never a DELETE.
		expect(server.writes.map(request => request.method())).toEqual(['POST']);
		const body = posts(server)[0].postDataJSON();
		// The change, and every stored field the operator never touched.
		expect(body.serviceArguments).toMatchObject({name: RULE, externalIP: VIP, port: PORT, host: 'a.example', mode: 4, fc_max_outstanding: 32, fc_mode: 'observe', max_stream_duration_sec: 600});
		expect(body.endpoints).toEqual([{endpointIP: '198.51.100.81', targetPort: 9001, weight: 1}]);
		expect(body.allowedSources).toEqual([{prefix: '10.9.0.0/16'}]);
		// Observations and the server's id are not the request's to send.
		for (const observed of ['id', 'fc_effective', 'half_close_effective']) expect(body.serviceArguments, observed).not.toHaveProperty(observed);

		// The sibling on the same VIP and port was not written.
		expect(server.rules.find(r => r.serviceArguments.name === SIBLING)?.serviceArguments.max_stream_duration_sec).toBe(111);
	});

	test('FPR-E2E-02: the body is built on the rule as the gateway holds it now, not as the list showed it', async ({page}) => {
		const server = await serve(page, [rule(), sibling()]);
		await openEdit(page);
		await changeMaxOutstanding(page, '16');

		// Another console changes a field this operator never touches, after
		// the dialog was opened from the older read.
		server.rules[0].serviceArguments.max_stream_duration_sec = 900;
		await dialogButton(page, 'Update').click();

		await expect(page.getByText('Load balancer rule updated successfully.')).toBeVisible({timeout: 20_000});
		expect(posts(server)[0].postDataJSON().serviceArguments).toMatchObject({fc_max_outstanding: 16, max_stream_duration_sec: 900});
	});

	test('FPR-E2E-03: an endpoint change asks before re-creating the listener, and Back returns the input', async ({page}) => {
		const server = await serve(page, [rule(), sibling()]);
		await openEdit(page);
		await changeEndpointPort(page, '9002');
		await dialogButton(page, 'Update').click();

		// Asked first; nothing is on the wire yet.
		await expect(dialogTitle(page, 'Re-create listener')).toBeVisible({timeout: 20_000});
		await expect(page.getByText(/removing the listener of this rule and building it again/)).toBeVisible();
		await expect(page.getByText('Changed fields: endpoints.')).toBeVisible();
		expect(server.writes).toHaveLength(0);

		// Back: the form again, still holding what was typed.
		await dialogButton(page, 'Back to the form').click();
		await expect(dialogTitle(page, 'Edit Load Balancer Rule')).toBeVisible();
		const eps = await expandSection(page, /^Endpoints$/);
		await expect(field(page, 'Target Port', eps).first()).toHaveValue('9002');
		expect(server.writes).toHaveLength(0);

		// Through this time.
		await dialogButton(page, 'Update').click();
		await dialogButton(page, 'Re-create listener').click();
		await expect(page.getByText('Listener re-created. The rule reads back with the submitted values.')).toBeVisible({timeout: 20_000});
		expect(server.writes.map(request => request.method())).toEqual(['POST']);
		expect(posts(server)[0].postDataJSON().endpoints).toEqual([{endpointIP: '198.51.100.81', targetPort: 9002, weight: 1}]);
		expect(server.rules.find(r => r.serviceArguments.name === SIBLING)?.endpoints[0].targetPort).toBe(9001);
	});

	test('FPR-E2E-04: a 409 is "already in this state" only when the rule reads back with the values', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 409, path: /\/config\/loadbalancer$/});
		const conflict = {status: 409, body: {code: 409, message: 'Resource Conflict', result: 'lbrule-exists error'}};

		// Arm 1: another console already made the same change.
		const server = await serve(page, [rule()]);
		await openEdit(page);
		await changeMaxOutstanding(page, '32');
		server.rules[0].serviceArguments.fc_max_outstanding = 32;
		server.answer = {...conflict, store: false};
		await dialogButton(page, 'Update').click();
		await expect(page.getByText('The gateway reported no change, and the rule already reads back with these values.')).toBeVisible({timeout: 20_000});
		await expect(page.getByText(/Failed to update/)).toHaveCount(0);
		await dialogButton(page, 'OK').click();

		// Arm 2: the gateway found nothing to act on and the rule does NOT hold
		// the values. That is a change that was not applied, and it says so.
		await page.unroute(LB_ALL_RE);
		await page.unroute(LB_WRITE_RE);
		const second = await serve(page, [rule()]);
		second.answer = {...conflict, store: false};
		await openEdit(page);
		await changeMaxOutstanding(page, '48');
		await dialogButton(page, 'Update').click();
		await expect(page.getByText(/found nothing in this request that it acts on, and the rule does not hold the submitted values/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText(/serviceArguments\.fc_max_outstanding/)).toBeVisible();
		await expect(page.getByText(/already reads back with these values/)).toHaveCount(0);
	});

	test('FPR-E2E-05: a refused re-creation keeps the input and reports the rule as it reads back', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 412, path: /\/config\/loadbalancer$/});
		const SENTENCE = 'the data plane did not install the rule: its listener or a TLS context could not be built, see the data plane log';
		const server = await serve(page, [rule()]);
		await openEdit(page);
		await changeEndpointPort(page, '9003');
		await dialogButton(page, 'Update').click();
		await expect(dialogTitle(page, 'Re-create listener')).toBeVisible({timeout: 20_000});

		// The gateway refuses, and the rule is gone from its list afterwards.
		server.answer = {status: 412, body: {code: 412, message: 'Server precondition not met for API call', result: SENTENCE}, store: false};
		server.dropOnWrite = true;
		const readsBefore = server.listReads;
		await dialogButton(page, 'Re-create listener').click();

		await expect(page.getByText(SENTENCE, {exact: false})).toBeVisible({timeout: 20_000});
		// What was read, and only that — and it WAS read after the write.
		expect(server.listReads).toBeGreaterThan(readsBefore);
		await expect(page.getByText('The rule is no longer listed on the gateway.', {exact: false})).toBeVisible();
		await expect(page.getByText(/re-created|updated successfully/)).toHaveCount(0);

		// The form is back with the attempted input, under the error.
		await page.getByRole('button', {name: 'OK', exact: true}).click();
		await expect(dialogTitle(page, 'Edit Load Balancer Rule')).toBeVisible();
		const eps = await expandSection(page, /^Endpoints$/);
		await expect(field(page, 'Target Port', eps).first()).toHaveValue('9003');
	});

	test('FPR-E2E-06: a rule that vanished after the list was read is not written', async ({page}) => {
		const server = await serve(page, [rule(), sibling()]);
		await openEdit(page);
		await changeMaxOutstanding(page, '8');

		// Removed elsewhere. Only the sibling still shares the VIP and port —
		// a lookup by tuple would find it and overwrite the wrong rule.
		server.rules.splice(0, 1);
		await dialogButton(page, 'Update').click();

		await expect(page.getByText(/no longer on the gateway as it was selected/)).toBeVisible({timeout: 20_000});
		expect(server.writes).toHaveLength(0);
		expect(server.rules[0].serviceArguments).toMatchObject({name: SIBLING, max_stream_duration_sec: 111});
	});
});
