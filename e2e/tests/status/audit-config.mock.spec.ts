//---------------------------------------------------------
// Audit Trail page (AUDCFG-E2E-01..07), mock contract layer.
//---------------------------------------------------------
// What the trail keeps and where it is sent: the policy, the compliance sink
// and the named sinks. EVERY /audit/* request is answered here, so nothing in
// this file changes the testbed gateway's audit configuration.
//
// The answers are shaped the way the gateway gives them: zero values absent,
// 204 with no body for an accepted change, 400 with no body for a refused one,
// and 404 for a named sink that is not there.
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

const AUDIT_RE = /\/netlox\/v1\/audit\/(.+?)(\?.*)?$/;
const POLICY = {max_segment_bytes: 67108864, max_segment_age_seconds: 86400};
const EDR = {name: 'e2e-edr', address: 'edr.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem', enterprise_number: 32473, state: 'connected', poison: 3};

type Call = {method: string; path: string; body: unknown};
type Gateway = {
	policy: Record<string, unknown>;
	sink: Record<string, unknown>;
	named: Record<string, Record<string, unknown>>;
	/** Status code for the next policy POST; 204 stores the body. */
	policyAnswer: number;
	calls: Call[];
};

let instName: string;

/** A stand-in for the gateway's audit handlers. */
async function mockGateway(page: Page, start: Partial<Gateway> = {}): Promise<Gateway> {
	const gw: Gateway = {policy: {...POLICY}, sink: {}, named: {}, policyAnswer: 204, calls: [], ...start};
	const json = (route: Route, status: number, body?: unknown) =>
		body === undefined ? route.fulfill({status}) : route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
	// omitempty: a zero the gateway holds is absent from its answer.
	const withoutZeros = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== 0 && v !== '' && v !== false));
	await page.route(AUDIT_RE, (route: Route) => {
		const req = route.request();
		const path = AUDIT_RE.exec(new URL(req.url()).pathname)![1];
		const method = req.method();
		const body = req.postData() ? JSON.parse(req.postData()!) : undefined;
		if (method !== 'GET') gw.calls.push({method, path, body});
		if (path === 'status') {
			const sinks = Object.keys(gw.named).sort().map(name => ({name, state: gw.named[name].state ?? 'starting'}));
			return json(route, 200, {available: true, running: true, sinks: sinks.length ? sinks : null});
		}
		if (path === 'policy') {
			if (method === 'GET') return json(route, 200, gw.policy);
			if (gw.policyAnswer !== 204) return json(route, gw.policyAnswer);
			gw.policy = withoutZeros(body);
			return json(route, 204);
		}
		if (path === 'sink') return method === 'GET' ? json(route, 200, gw.sink) : json(route, 204);
		const name = /^sinks\/(.+)$/.exec(path)?.[1];
		if (name !== undefined) {
			if (method === 'GET') return gw.named[name] ? json(route, 200, gw.named[name]) : json(route, 404, {code: 404, message: 'no audit sink of that name'});
			if (method === 'DELETE') {
				if (!gw.named[name]) return json(route, 404, {code: 404, message: 'no audit sink of that name'});
				delete gw.named[name];
				return json(route, 204);
			}
			gw.named[name] = {name, state: 'starting', ...withoutZeros(body)};
			return json(route, 204);
		}
		return json(route, 404);
	});
	return gw;
}

async function openAuditPage(page: Page) {
	const landed = page.waitForResponse(resp => /\/audit\/status$/.test(new URL(resp.url()).pathname));
	await page.goto(`instance/maintenance/audit?name=${instName}`);
	await landed;
	// The layout's title bar and the page both carry the name.
	await expect(page.getByRole('heading', {name: 'Audit Trail'}).first()).toBeVisible({timeout: 20_000});
}

const stat = (page: Page, section: string, label: string) => page.getByTestId(section).getByText(label, {exact: true}).locator('xpath=following-sibling::*[1]');

test.describe('@gw Audit Trail page — administrator (mock)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('AUDCFG-E2E-01: a policy change sends all six values and is reported from the readback', async ({page}) => {
		const gw = await mockGateway(page);
		await openAuditPage(page);
		await expect(stat(page, 'audit-policy', 'Seal a segment at (bytes)')).toHaveText('67108864');
		// Absent in the answer, shown as the value in use.
		await expect(stat(page, 'audit-policy', 'Deletions per retention pass')).toHaveText('1');

		await page.getByTestId('audit-policy').getByRole('button', {name: 'Change', exact: true}).click();
		await page.getByTestId('audit-field-retention_max_bytes').fill('1073741824');
		await page.getByRole('dialog').getByRole('button', {name: 'Save'}).click();
		await expect(page.getByText('Saved. The gateway reads back what was sent.')).toBeVisible();

		expect(gw.calls).toEqual([
			{
				method: 'POST',
				path: 'policy',
				body: {max_segment_bytes: 67108864, max_segment_age_seconds: 86400, retention_max_age_seconds: 0, retention_max_bytes: 1073741824, retention_reserve_bytes: 0, retention_max_prune_per_pass: 1},
			},
		]);
		await page.getByRole('button', {name: 'OK'}).click();
		await expect(stat(page, 'audit-policy', 'Keep at most (bytes of sealed segments)')).toHaveText('1073741824');
	});

	test('AUDCFG-E2E-02: a refused policy (400, no body) keeps the dialog and what was typed', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 400, path: /\/audit\/policy$/});
		const gw = await mockGateway(page, {policyAnswer: 400});
		await openAuditPage(page);
		await page.getByTestId('audit-policy').getByRole('button', {name: 'Change', exact: true}).click();
		await page.getByTestId('audit-field-retention_reserve_bytes').fill('123456');
		await page.getByRole('dialog').getByRole('button', {name: 'Save'}).click();
		await expect(page.getByText('The gateway refused these values (400) and does not say which one. Nothing was changed, and what you entered is kept.')).toBeVisible();
		await page.getByRole('button', {name: 'OK'}).click();
		await expect(page.getByTestId('audit-field-retention_reserve_bytes')).toHaveValue('123456');
		expect(gw.calls).toHaveLength(1);
		expect(gw.policy).toEqual(POLICY);
	});

	test('AUDCFG-E2E-03: `{}` from the policy read is no writer: unknown, and nothing to press', async ({page}) => {
		await mockGateway(page, {policy: {}});
		await openAuditPage(page);
		const section = page.getByTestId('audit-policy');
		await expect(section.getByRole('alert')).toContainText('The values are unknown, not zero.');
		await expect(section.getByRole('button')).toHaveCount(0);
		await expect(section.getByText('Seal a segment at (bytes)')).toHaveCount(0);
	});

	test('AUDCFG-E2E-04: a named sink is added, read back by name, then deleted and confirmed by a 404', async ({page, consoleGuard}) => {
		// The read that confirms the delete. It must stay on the page: a 404
		// for one sink is not a missing page.
		consoleGuard.allowRequest({status: 404, path: /\/audit\/sinks\/e2e-lake$/});
		const gw = await mockGateway(page, {named: {'e2e-edr': {...EDR}}});
		await openAuditPage(page);
		await expect(stat(page, 'audit-named-sink-e2e-edr', 'Records passed over')).toHaveText('3');

		await page.getByTestId('audit-named-sinks').getByRole('button', {name: 'Add a sink'}).click();
		await page.getByTestId('audit-field-name').fill('e2e-lake');
		await page.getByTestId('audit-field-address').fill('lake.example:6514');
		await page.getByTestId('audit-field-ca_bundle_path').fill('/etc/loxilb/ca.pem');
		await page.getByTestId('audit-field-enterprise_number').fill('32473');
		await page.getByRole('dialog').getByRole('checkbox', {name: 'mgmt'}).check();
		await page.getByRole('dialog').getByRole('button', {name: 'Save'}).click();
		await expect(page.getByText('Saved. The gateway reads back what was sent.')).toBeVisible();
		await page.getByRole('button', {name: 'OK'}).click();
		expect(gw.calls[0]).toEqual({
			method: 'PUT',
			path: 'sinks/e2e-lake',
			body: {address: 'lake.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem', server_name: '', client_cert_path: '', client_key_path: '', facility: 0, max_frame_bytes: 0, enterprise_number: 32473, filter: {streams: ['mgmt'], services: [], outcome: '', data_sample: 0}},
		});
		const card = page.getByTestId('audit-named-sink-e2e-lake');
		await expect(card).toBeVisible();
		await expect(stat(page, 'audit-named-sink-e2e-lake', 'Filter')).toHaveText('streams mgmt');

		await card.getByRole('button', {name: 'Delete'}).click();
		await page.getByRole('button', {name: 'Delete', exact: true}).last().click();
		await expect(page.getByText('Saved. The gateway reads back what was sent.')).toBeVisible();
		await page.getByRole('button', {name: 'OK'}).click();
		await expect(card).toHaveCount(0);
		expect(gw.calls[1]).toMatchObject({method: 'DELETE', path: 'sinks/e2e-lake'});
		expect(page.url()).toMatch(/\/maintenance\/audit/);
		await expect(page.getByTestId('audit-named-sink-e2e-edr')).toBeVisible();
	});

	test('AUDCFG-E2E-05: a compliance sink with no session yet is a row, not an alarm; a save sends no counter back', async ({page}) => {
		const gw = await mockGateway(page, {sink: {enabled: true, address: 'siem.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem', submitted: 90, write_errors: 2, last_error: 'broken pipe'}});
		await openAuditPage(page);
		const section = page.getByTestId('audit-compliance-sink');
		await expect(stat(page, 'audit-compliance-sink', 'Session established')).toHaveText('No');
		await expect(stat(page, 'audit-compliance-sink', 'Syslog facility')).toHaveText('13 (default)');
		await expect(section.getByRole('alert')).toHaveCount(0);

		await section.getByRole('button', {name: 'Change', exact: true}).click();
		await page.getByTestId('audit-field-facility').fill('16');
		await page.getByRole('dialog').getByRole('button', {name: 'Save'}).click();
		// The stand-in keeps its sink as it was, so the readback differs.
		await expect(page.getByText('The change was accepted, but the gateway reads back something else for: Syslog facility.')).toBeVisible();
		expect(gw.calls[0].body).toEqual({enabled: true, address: 'siem.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem', server_name: '', client_cert_path: '', client_key_path: '', facility: 16, max_frame_bytes: 0});
	});
});

test.describe('@gw Audit Trail page — operator (mock)', () => {
	test.use({storageState: '.auth/operator.json'});
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('AUDCFG-E2E-06: an operator reads the settings and is offered no control', async ({page}) => {
		const gw = await mockGateway(page, {named: {'e2e-edr': {...EDR}}});
		await openAuditPage(page);
		await expect(page.getByTestId('audit-read-only')).toContainText('needs the administrator role');
		await expect(stat(page, 'audit-policy', 'Seal a segment at (bytes)')).toHaveText('67108864');
		await expect(stat(page, 'audit-named-sink-e2e-edr', 'Enterprise number')).toHaveText('32473');
		for (const id of ['audit-policy', 'audit-compliance-sink', 'audit-named-sinks']) {
			await expect(page.getByTestId(id).getByRole('button', {name: /Change|Reset|Seal|Stop|Configure|Add a sink|Delete/})).toHaveCount(0);
		}
		expect(gw.calls).toEqual([]);
	});
});

test.describe('@gw Audit Trail page — viewer (mock)', () => {
	test.use({storageState: '.auth/viewer.json'});
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('AUDCFG-E2E-07: a viewer is told the page is not for the role, and no audit read is sent', async ({page}) => {
		const reads: string[] = [];
		page.on('request', r => {
			if (AUDIT_RE.test(new URL(r.url()).pathname)) reads.push(r.url());
		});
		await mockGateway(page);
		await page.goto(`instance/maintenance/audit?name=${instName}`);
		await expect(page.getByTestId('role-denied')).toBeVisible({timeout: 20_000});
		const menu = page.getByRole('navigation', {name: 'Main menu'});
		await menu.getByRole('button', {name: 'Maintenance', exact: true}).click();
		await expect(menu.getByText('Operator Maintenance', {exact: true})).toBeVisible();
		await expect(menu.getByText('Audit Trail', {exact: true})).toHaveCount(0);
		expect(reads, 'a viewer must not send the audit reads the backend refuses').toEqual([]);
	});
});
