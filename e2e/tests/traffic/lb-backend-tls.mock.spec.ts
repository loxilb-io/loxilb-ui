//---------------------------------------------------------
// LB rule form — backend TLS (BT-E2E-01..04), mock contract.
//---------------------------------------------------------
// A fullproxy rule with e2ehttps security can ask the gateway to verify its
// endpoints against a CA bundle, to present a client certificate, and to send
// a server name. The request is four rule members; the gateway refuses a
// half-formed one, and refuses all of them off that leg.
//
// ⭐ Intercepted: the rule part of `/meta`, the rule list and the LB writes.
// /version and the rest of /meta stay real, so the flavor gate is exercised.
// Whether a gateway takes the request is set per case: the question is what
// the form does with the declaration, not what this gateway declares. Nothing
// reaches the gateway's rule table.
import type {Page, Request, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialogButton, dialogTitle, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';

const META_RE = /\/netlox\/v1\/meta(\?.*)?$/;
const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_WRITE_RE = /\/netlox\/v1\/config\/loadbalancer(\/(?!all)[^?]*)?(\?.*)?$/;

const BACKEND_TLS = ['mtls_backend', 'backend_ca_cert_id', 'backend_client_cert_id', 'backend_tls_server_name'];

let instName: string;

/** Serve the real /meta with the rule's backend TLS server name declared, or not. */
async function declareBackendTls(page: Page, declared: boolean): Promise<{served: () => number}> {
	let served = 0;
	await page.route(META_RE, async (route: Route) => {
		const resp = await route.fetch();
		const meta = await resp.json();
		const sa = meta['/config/loadbalancer']?.fields?.serviceArguments;
		if (!sa) throw new Error('/meta has no /config/loadbalancer serviceArguments — the fixture no longer matches the gateway');
		const props = sa.properties ?? sa;
		delete props.backend_tls_server_name;
		if (declared) props.backend_tls_server_name = {type: 'string', required: false};
		await route.fulfill({response: resp, json: meta});
		served++;
	});
	return {served: () => served};
}

async function recordWrites(page: Page): Promise<Request[]> {
	const writes: Request[] = [];
	await page.route(LB_ALL_RE, (route: Route) => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: []})}));
	await page.route(LB_WRITE_RE, (route: Route) => {
		writes.push(route.request());
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({code: 200, result: 'Success'})});
	});
	return writes;
}

/** Open Add, fill a minimal rule on the given mode and security, and open Advanced Settings. */
async function openAdd(page: Page, meta: {served: () => number}, mode: string, security?: string) {
	await page.goto(`instance/traffic/lb?name=${instName}`);
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	// The form's fields come from /meta, so the stub has been served by now;
	// said outright, because every case below depends on which one was.
	expect(meta.served(), 'the stubbed /meta was served to the form').toBeGreaterThan(0);
	await field(page, 'Rule Name').fill('e2e-backend-tls');
	await expandSection(page, /^Basic Settings/);
	await field(page, 'External IP').fill('192.0.2.73');
	await field(page, 'Port Min').fill('18473');
	const eps = await expandSection(page, /^Endpoints$/);
	await eps.getByRole('button', {name: 'Add', exact: true}).click();
	await field(page, 'IP', eps).first().fill('198.51.100.73');
	await field(page, 'Target Port', eps).first().fill('18473');
	const advanced = await expandSection(page, /^Advanced Settings/);
	await selectOption(page, 'Mode', mode);
	if (security) await selectOption(page, 'Security', security);
	return advanced;
}

/**
 * The create went out and the app said so. The stubbed rule list stays empty,
 * so the app reports what it can vouch for — accepted, not yet seen — and not
 * "Success".
 */
async function expectSubmitted(page: Page, writes: Request[]): Promise<void> {
	await expect(dialogTitle(page, 'Submitted')).toBeVisible({timeout: 30_000});
	expect(writes.map(r => r.method())).toEqual(['POST']);
}

const sent = (writes: Request[]) => writes[0].postDataJSON().serviceArguments as Record<string, unknown>;

test.describe('@gw LB backend TLS — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('BT-E2E-01: a gateway that does not declare the server name is offered nothing and sent nothing', async ({page}) => {
		const meta = await declareBackendTls(page, false);
		const writes = await recordWrites(page);
		const advanced = await openAdd(page, meta, 'fullproxy', 'e2ehttps');
		await expect(field(page, 'Backend TLS Server Name', advanced)).toHaveCount(0);
		await expect(advanced.getByLabel('Verify Backend Certificate')).toHaveCount(0);

		await dialogButton(page, 'Create').click();
		await expectSubmitted(page, writes);
		for (const member of BACKEND_TLS) expect(sent(writes), member).not.toHaveProperty(member);
	});

	test('BT-E2E-02: a full request is sent as four members on the re-encrypting leg', async ({page}) => {
		const meta = await declareBackendTls(page, true);
		const writes = await recordWrites(page);
		const advanced = await openAdd(page, meta, 'fullproxy', 'e2ehttps');

		await advanced.getByLabel('Verify Backend Certificate').check();
		// Verification with no CA is refused by the gateway: said here, and not sent.
		await expect(advanced.getByText('Backend verification needs a CA certificate ID: there is no default trust store.')).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();

		await field(page, 'Backend CA Cert ID', advanced).fill('backend-ca');
		await field(page, 'Backend Client Cert ID', advanced).fill('backend-client');
		await field(page, 'Backend TLS Server Name', advanced).fill('api.internal');
		await expect(dialogButton(page, 'Create')).toBeEnabled();
		await dialogButton(page, 'Create').click();

		await expectSubmitted(page, writes);
		expect(sent(writes)).toMatchObject({
			mode: 4,
			security: 2,
			mtls_backend: {verify_server_cert: true},
			backend_ca_cert_id: 'backend-ca',
			backend_client_cert_id: 'backend-client',
			backend_tls_server_name: 'api.internal',
		});
	});

	test('BT-E2E-03: an address as the server name is refused in the form', async ({page}) => {
		const meta = await declareBackendTls(page, true);
		const writes = await recordWrites(page);
		const advanced = await openAdd(page, meta, 'fullproxy', 'e2ehttps');

		await field(page, 'Backend TLS Server Name', advanced).fill('198.51.100.73');
		await expect(advanced.getByText(/must be a DNS name, not an address/)).toBeVisible();
		await expect(dialogButton(page, 'Create')).toBeDisabled();
		expect(writes).toEqual([]);
	});

	test('BT-E2E-04: a request left from e2ehttps does not travel once the rule is plain https', async ({page}) => {
		const meta = await declareBackendTls(page, true);
		const writes = await recordWrites(page);
		const advanced = await openAdd(page, meta, 'fullproxy', 'e2ehttps');

		await advanced.getByLabel('Verify Backend Certificate').check();
		await field(page, 'Backend CA Cert ID', advanced).fill('backend-ca');
		await field(page, 'Backend TLS Server Name', advanced).fill('api.internal');

		await selectOption(page, 'Security', 'https');
		await expect(field(page, 'Backend CA Cert ID', advanced)).toBeDisabled();
		await expect(advanced.getByLabel('Verify Backend Certificate')).not.toBeChecked();
		// The leftover is out of reach now, so it must not hold the draft back.
		await expect(dialogButton(page, 'Create')).toBeEnabled();
		await dialogButton(page, 'Create').click();

		await expectSubmitted(page, writes);
		expect(sent(writes)).toMatchObject({mode: 4, security: 1});
		for (const member of BACKEND_TLS) expect(sent(writes), member).not.toHaveProperty(member);
	});
});
