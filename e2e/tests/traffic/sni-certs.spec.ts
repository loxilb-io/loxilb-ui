//---------------------------------------------------------
// SNI Certificates page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §1.7).
//
// NB: this page is NOT a multipart cert upload (the plan predated the
// implementation). It registers a hostname → cert-directory mapping in the
// gateway's global SNI store: JSON POST /sni/certificates {hostname,
// certPath?}, body-based DELETE /sni/certificates {hostname}. The actual PEM
// material is a separate "Upload PEM" feature (/config/cert), out of scope
// here. Entities use the e2e- hostname prefix; the afterEach sweep removes
// leftovers. Whether the gateway accepts a hostname-only registration (no
// cert files on disk) is probed once and the round-trip cases adapt.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepSniCerts} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, dialogTitle} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const SNI_PATH = '/sni/certificates';

let instName: string;
let canRegister = false; // gateway accepts a hostname-only registration?

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('New SNI Certificate Registration')).toBeVisible();
	await expect(field(page, 'Hostname')).toBeVisible();
}

async function submitRegister(page: Page): Promise<any> {
	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().includes(SNI_PATH)),
		dialogButton(page, 'Register').click(),
	]);
	return req;
}

/** Waits for the terminal Success/Error popup and dismisses it. */
async function dismissResult(page: Page, ok: boolean): Promise<void> {
	await expect(dialogTitle(page, ok ? 'Success' : 'Error')).toBeVisible();
	await dialogButton(page, 'OK').click();
}

async function captureDeletes(page: Page, action: () => Promise<void>): Promise<any[]> {
	const reqs: any[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(SNI_PATH)) reqs.push(r);
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return reqs;
}

test.describe('SNI Certificates page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepSniCerts();
		// Probe once whether a bare-hostname registration is actually LISTABLE.
		// The gateway returns HTTP 200 even when it soft-fails ("Failed to load
		// certificate ... check files at /opt/loxilb/cert/{host}"), so status
		// alone is not enough — confirm the hostname shows up in the list. On a
		// testbed with no cert files on disk this stays false and the round-trip
		// / D-multi cases skip.
		const probeHost = 'e2e-sni-probe.example.com';
		await gw('POST', SNI_PATH, {hostname: probeHost});
		const listResp = await gw('GET', SNI_PATH);
		const listed = listResp.ok ? await listResp.json() : {};
		const items = listed.certificates ?? listed.sniAttr ?? [];
		canRegister = Array.isArray(items) && items.some((c: any) => c.hostname === probeHost);
		await gw('DELETE', SNI_PATH, {hostname: probeHost});
	});

	test.afterEach(async () => {
		await sweepSniCerts();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/sni-certs?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: register a bare hostname — payload carries no client-side keys', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 4\d\d/);

		await openAddDialog(page);
		await field(page, 'Hostname').fill('e2e-sni.example.com');

		const req = await submitRegister(page);
		const body = req.postDataJSON();
		expect(body.hostname).toBe('e2e-sni.example.com');
		// The form's isValid must not leak into the POST payload,
		// and an unset optional certPath must be omitted (not sent as '').
		expect(body.isValid).toBeUndefined();
		expect(body.certPath).toBeUndefined();

		// The gateway reports cert-load failures inside a 200 body, so the UI
		// verdict must track the result text — Success only when the body does
		// not carry an Error result.
		const respBody = await (await req.response())?.json();
		const ok = !(typeof respBody?.result === 'string' && respBody.result.startsWith('Error'));
		await dismissResult(page, ok);

		if (canRegister) {
			// Round-trip: the row appears and D-single removes it (DELETE body).
			await refreshUntilRow(page, 'e2e-sni.example.com');
			const deletes = await captureDeletes(page, async () => {
				await selectRowByText(page, 'e2e-sni.example.com');
				await toolbarButton(page, 'Delete').click();
				await confirmDelete(page);
				await expect(dialog(page).getByText('Deleted 1 certificate(s) successfully.')).toBeVisible();
				await dialogButton(page, 'OK').click();
			});
			expect(deletes).toHaveLength(1);
			expect(deletes[0].postDataJSON().hostname).toBe('e2e-sni.example.com');
			await refreshUntilGone(page, 'e2e-sni.example.com');
		}
	});

	test('C-full: hostname + explicit certPath both land in the POST body', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 4\d\d/);

		await openAddDialog(page);
		await field(page, 'Hostname').fill('e2e-sni-full.example.com');
		await field(page, 'Certificate Path (Optional)').fill('/opt/loxilb/cert/e2e-custom');

		const req = await submitRegister(page);
		const body = req.postDataJSON();
		expect(body).toMatchObject({hostname: 'e2e-sni-full.example.com', certPath: '/opt/loxilb/cert/e2e-custom'});
		expect(body.isValid).toBeUndefined();

		// Same verdict rule as C-min: the dialog must match the result body,
		// not the HTTP status.
		const respBody = await (await req.response())?.json();
		const ok = !(typeof respBody?.result === 'string' && respBody.result.startsWith('Error'));
		await dismissResult(page, ok);
	});

	test('V-soft-fail: a register the gateway could not load surfaces as Error, not Success', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 4\d\d/);

		// A certPath that cannot exist forces the loader to fail on any testbed;
		// the gateway still answers HTTP 200 with {"result":"Error: …"} — the UI
		// must key on the result text and report the failure.
		await openAddDialog(page);
		await field(page, 'Hostname').fill('e2e-sni-softfail.example.com');
		await field(page, 'Certificate Path (Optional)').fill('/nonexistent/e2e-sni-path');

		const req = await submitRegister(page);
		expect((await req.response())?.status(), 'gateway soft-fails with HTTP 200').toBe(200);

		await expect(dialogTitle(page, 'Error')).toBeVisible();
		await expect(dialog(page).getByText(/Failed to load certificate/)).toBeVisible();
		await dialogButton(page, 'OK').click();
	});

	test('V-host: empty hostname blocks the Register button', async ({page}) => {
		await openAddDialog(page);
		// Hostname is required and starts empty → Register stays disabled.
		await expect(dialogButton(page, 'Register')).toBeDisabled();
		await field(page, 'Hostname').fill('e2e-sni-v.example.com');
		await expect(dialogButton(page, 'Register')).toBeEnabled();
		await field(page, 'Hostname').fill('');
		await expect(dialogButton(page, 'Register')).toBeDisabled();
		await dialogButton(page, 'Cancel').click();
	});

	test('D-multi: bulk delete unregisters every selected hostname', async ({page}) => {
		test.skip(!canRegister, 'gateway does not accept hostname-only registration on this testbed');

		for (const h of ['e2e-sni-d1.example.com', 'e2e-sni-d2.example.com', 'e2e-sni-d3.example.com']) {
			const resp = await gw('POST', SNI_PATH, {hostname: h});
			expect(resp.status, `API seed ${h}`).toBeLessThan(300);
		}
		await refreshUntilRow(page, 'e2e-sni-d1.example.com');
		await refreshUntilRow(page, 'e2e-sni-d3.example.com');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, 'e2e-sni-d1.example.com');
			await selectRowByText(page, 'e2e-sni-d2.example.com');
			await selectRowByText(page, 'e2e-sni-d3.example.com');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 certificate(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes, 'one DELETE per selected hostname').toHaveLength(3);
		const hosts = deletes.map(r => r.postDataJSON().hostname).sort();
		expect(hosts).toEqual(['e2e-sni-d1.example.com', 'e2e-sni-d2.example.com', 'e2e-sni-d3.example.com']);
		await refreshUntilGone(page, /e2e-sni-d[123]\.example\.com/);
	});
});
