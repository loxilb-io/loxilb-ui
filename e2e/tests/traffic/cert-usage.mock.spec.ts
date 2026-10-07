//---------------------------------------------------------
// Certificate usage on the inline-PEM upload (/config/cert): a listener
// certificate, a CA bundle a rule verifies its backends against, or a client
// certificate a rule presents to them.
//
// ⭐ Only the certificate part of `/meta` and the certificate POST are
// intercepted; everything else is the live instance. The usage a gateway
// declares is set per case, because the question each one asks is what the
// page does with a declaration, not what this particular gateway declares.
// The POST never reaches the gateway, so nothing is stored and nothing needs
// sweeping.
//---------------------------------------------------------
import {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openDialog, selectOption} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const META_RE = /\/netlox\/v1\/meta(\?.*)?$/;
const CERT_POST_RE = /\/netlox\/v1\/config\/cert$/;
const CERT_GET_RE = /\/netlox\/v1\/config\/cert\/[^/]+$/;

const CERT = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
// Armor only: the form checks the armor line and the request is never sent on.
const KEY = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + '\nAAAA';

/** Serve the real /meta with `usage` declared on the certificate entry, or not. */
async function declareUsage(page: Page, declared: boolean): Promise<{served: () => number}> {
	let served = 0;
	await page.route(META_RE, async (route: Route) => {
		const resp = await route.fetch();
		const meta = await resp.json();
		const fields = meta['/config/cert']?.fields;
		if (!fields) throw new Error('/meta has no /config/cert fields — the fixture no longer matches the gateway');
		const props = fields.properties ?? fields;
		delete props.usage;
		if (declared) props.usage = {type: 'string', enum: ['server', 'ca', 'client'], required: false};
		await route.fulfill({response: resp, json: meta});
		served++;
	});
	return {served: () => served};
}

/** Answer the certificate POST here and keep what was sent. */
async function captureUpload(page: Page): Promise<{bodies: unknown[]}> {
	const bodies: unknown[] = [];
	await page.route(CERT_POST_RE, async (route: Route) => {
		if (route.request().method() !== 'POST') return route.fallback();
		bodies.push(route.request().postDataJSON());
		await route.fulfill({status: 201, contentType: 'application/json', body: '{}'});
	});
	// An upload under a chosen ID is confirmed by reading the entry back. The
	// gateway under test stores nothing from the stubbed POST, so the read is
	// answered here with what was sent — less the key, as the gateway does.
	await page.route(CERT_GET_RE, async (route: Route) => {
		if (route.request().method() !== 'GET') return route.fallback();
		const sent = bodies[bodies.length - 1] as {usage?: string; certId?: string; certPem?: string} | undefined;
		if (!sent) return route.fulfill({status: 404, body: ''});
		await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({certId: sent.certId, usage: sent.usage ?? 'server', certPem: sent.certPem, hostnames: []})});
	});
	return {bodies};
}

let instName: string;

/**
 * Opens the upload dialog and waits until the stubbed /meta has been served.
 *
 * ⚠️ The dialog does not wait for /meta: its fields are fixed, and only the
 * usage choice depends on the read, which is made as the dialog mounts.
 * Asserted any earlier, "no choice is offered" is true of every gateway while
 * the read is still in flight, and the read through the proxy can take seconds.
 */
async function openUpload(page: Page, meta: {served: () => number}): Promise<void> {
	await page.goto(`instance/traffic/sni-certs?name=${instName}`); // relative — see baseURL note
	const upload = page.getByRole('button', {name: 'Upload PEM'});
	await expect(upload).toBeVisible({timeout: 20_000});
	await openDialog(page, field(page, 'Cert ID'), () => upload.click());
	await expect.poll(meta.served, {message: 'the stubbed /meta was served to the dialog', timeout: 30_000}).toBeGreaterThan(0);
}

test.describe('Certificate usage on PEM upload', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('CU-01 a gateway that does not declare usage is offered no choice, and is sent what it was always sent', async ({page}) => {
		const meta = await declareUsage(page, false);
		const upload = await captureUpload(page);
		await openUpload(page, meta);

		await field(page, 'Certificate (PEM)').fill(CERT);
		await field(page, 'Private Key (PEM)').fill(KEY);
		// Checked after the fields are filled: the read has been rendered by now.
		await expect(dialog(page).getByRole('combobox', {name: /^Certificate Usage/})).toHaveCount(0);
		await dialogButton(page, 'Upload').click();

		await expect(dialogTitle(page, 'Success')).toBeVisible();
		expect(upload.bodies).toEqual([{certPem: CERT, keyPem: KEY, chainPem: ''}]);
	});

	test('CU-02 a CA bundle is sent with its usage, the chosen ID and an empty key', async ({page}) => {
		const meta = await declareUsage(page, true);
		const upload = await captureUpload(page);
		await openUpload(page, meta);

		await expect(dialog(page).getByRole('combobox', {name: /^Certificate Usage/})).toBeVisible();
		// A key typed before the choice must not travel with the bundle.
		await field(page, 'Private Key (PEM)').fill(KEY);
		await selectOption(page, 'Certificate Usage', 'Backend CA bundle');
		await expect(field(page, 'Private Key (PEM)')).toHaveCount(0);

		await field(page, 'CA Certificate(s) (PEM)').fill(CERT);
		// No list shows a CA bundle, so the ID is the operator's to choose.
		await expect(dialogButton(page, 'Upload')).toBeDisabled();
		await field(page, 'Cert ID').fill('backend-ca');
		await dialogButton(page, 'Upload').click();

		await expect(dialogTitle(page, 'Success')).toBeVisible();
		expect(upload.bodies).toEqual([{usage: 'ca', certId: 'backend-ca', certPem: CERT, keyPem: '', chainPem: ''}]);
	});

	test('CU-03 a client certificate is sent with its usage and its key', async ({page}) => {
		const meta = await declareUsage(page, true);
		const upload = await captureUpload(page);
		await openUpload(page, meta);

		await selectOption(page, 'Certificate Usage', 'Backend client certificate');
		await field(page, 'Cert ID').fill('backend-client');
		await field(page, 'Certificate (PEM)').fill(CERT);
		await expect(dialogButton(page, 'Upload')).toBeDisabled();
		await field(page, 'Private Key (PEM)').fill(KEY);
		await dialogButton(page, 'Upload').click();

		await expect(dialogTitle(page, 'Success')).toBeVisible();
		expect(upload.bodies).toEqual([{usage: 'client', certId: 'backend-client', certPem: CERT, keyPem: KEY, chainPem: ''}]);
	});
});
