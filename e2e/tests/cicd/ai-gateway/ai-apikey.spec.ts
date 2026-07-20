//---------------------------------------------------------
// cicd source: cicd/ai-apikey — AI Gateway API-key + tenant rate-limit CRUD.
//
// This is the ONE cicd AI surface that needs the gateway to be built with
// --userservice (CG-9): /config/ai/apikey and /config/ai/ratelimit 501 without
// it. The shared testbed is currently built WITHOUT --userservice, so the CRUD
// path auto-skips here (the field-complete render + client-validation coverage
// already lives in e2e/tests/ai/apikey.spec.ts + ratelimit.spec.ts, which run
// unconditionally). This spec's job is to make the CG-9 dependency explicit and
// to light up the moment --userservice is enabled on the CI gateway.
//
// STATUS: CG-9 NOT yet enabled on the testbed (probe → 501). Enabling
// --userservice is a gateway/oam launch decision (plan §13.1) owned by the
// engineers — not a UI change — so the CRUD leg stays skipped until then.
//---------------------------------------------------------
import {expect, test} from '../../../fixtures';
import {activeInstance, gatewayLacksUserservice, gw, sweepApiKeys} from '../../../helpers/api';
import {dialog, dialogButton, dialogTitle} from '../../../helpers/dialogs';
import {field} from '../../../helpers/form';
import {rowByText, showAllRows, toolbarButton} from '../../../helpers/table';

const APIKEY_PATH = '/config/ai/apikey';

let instName: string;
let noUserservice: boolean;

test.describe('cicd/ai-apikey — AI API-key CRUD (needs CG-9 --userservice)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		noUserservice = await gatewayLacksUserservice();
		if (!noUserservice) await sweepApiKeys();
	});

	test.afterEach(async () => {
		if (!noUserservice) await sweepApiKeys();
	});

	test('CG-9 status: /config/ai/apikey requires --userservice (documents the 501 gate)', async () => {
		// A plain probe of the gateway capability — the single assertion that
		// records whether CG-9 is live on this testbed.
		const resp = await gw('GET', APIKEY_PATH);
		if (noUserservice) {
			expect(resp.status, 'AI apikey 501s until --userservice is enabled (CG-9)').toBe(501);
		} else {
			expect(resp.ok, 'AI apikey list is served once --userservice is enabled').toBeTruthy();
		}
	});

	test('C → one-time raw_key; D (needs --userservice; auto-skips otherwise)', async ({page, consoleGuard}) => {
		test.skip(noUserservice, 'gateway built without --userservice — /config/ai/* 501s (CG-9 pending)');

		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/apikey?name=${instName}`); // relative — baseURL carries /netlox
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});

		await toolbarButton(page, 'Add').click();
		await field(page, 'Tenant ID').fill('e2e-cicd-tenant');
		await field(page, 'Name').fill('e2e-cicd-key');
		await page.mouse.move(0, 0);
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith(APIKEY_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({tenant_id: 'e2e-cicd-tenant', name: 'e2e-cicd-key', enabled: true});
		expect(body.isValid).toBeUndefined();
		expect((await req.response())?.status()).toBeLessThan(300);

		// The plaintext key is surfaced exactly once.
		await expect(dialogTitle(page, 'API Key Created')).toBeVisible();
		await dialogButton(page, 'OK').click();

		// D by key_id (the sweep also covers it, but delete through the UI here).
		const list = await (await gw('GET', `${APIKEY_PATH}?tenant_id=e2e-cicd-tenant`)).json();
		const created = (Array.isArray(list) ? list : []).find((k: any) => k.name === 'e2e-cicd-key');
		expect(created?.key_id).toBeTruthy();
		await showAllRows(page);
		await rowByText(page, 'e2e-cicd-key').first().getByRole('checkbox').check();
		await toolbarButton(page, 'Delete').click();
		await dialogButton(page, 'Delete').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});
});
