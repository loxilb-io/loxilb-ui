//---------------------------------------------------------
// cicd source: cicd/ai-apikey — AI Gateway API-key + tenant rate-limit CRUD.
//
// These routes are independent of the legacy userservice flag. The readiness
// probe distinguishes Gateway management authentication/authorization from
// API-key-store availability. A 501 is always a contract regression.
//---------------------------------------------------------
import {expect, test} from '../../../fixtures';
import {activeInstance, AIManagementReadiness, gatewayAIManagementReadiness, gw, sweepApiKeys} from '../../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../../helpers/dialogs';
import {field} from '../../../helpers/form';
import {rowByText, showAllRows, toolbarButton} from '../../../helpers/table';

const APIKEY_PATH = '/config/ai/apikey';

let instName: string;
let readiness: AIManagementReadiness;

test.describe('@gw cicd/ai-apikey — AI API-key management contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		readiness = await gatewayAIManagementReadiness();
		if (readiness.ready) await sweepApiKeys();
	});

	test.afterEach(async () => {
		if (readiness.ready) await sweepApiKeys();
	});

	test('capability status: route is registered and reports an explicit readiness state', async () => {
		const resp = await gw('GET', APIKEY_PATH);
		expect(resp.status, 'AI API-key route must be registered independently of userservice').not.toBe(501);
		expect([200, 401, 403, 503], 'response must identify management auth/RBAC/store readiness').toContain(resp.status);
	});

	test('C → one-time raw_key; D (needs management/store readiness)', async ({page, consoleGuard}) => {
		test.skip(!readiness.ready, readiness.reason);

		consoleGuard.allow(/Failed to load resource/i);
		await page.goto(`instance/ai/apikey?name=${instName}`); // relative — baseURL carries /netlox
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});

		await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI API Key'}));
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

		// The plaintext key is surfaced exactly once — the reveal is persistent,
		// so Escape and a backdrop click must NOT dismiss it before OK.
		await expect(dialogTitle(page, 'API Key Created')).toBeVisible();
		await page.keyboard.press('Escape');
		await page.mouse.click(5, 5);
		await expect(dialogTitle(page, 'API Key Created')).toBeVisible();
		await dialogButton(page, 'OK').click();

		// D by key_id (the sweep also covers it, but delete through the UI here).
		const list = await (await gw('GET', `${APIKEY_PATH}?tenant_id=e2e-cicd-tenant`)).json();
		const created = (Array.isArray(list) ? list : []).find((k: any) => k.name === 'e2e-cicd-key');
		expect(created?.key_id).toBeTruthy();
		await showAllRows(page);
		await rowByText(page, 'e2e-cicd-key').first().getByRole('checkbox').check();
		await openToolbarDialog(page, 'Delete', dialogTitle(page, 'WARNING!! Delete Item'));
		await dialogButton(page, 'Delete').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});
});
