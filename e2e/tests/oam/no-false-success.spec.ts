//---------------------------------------------------------
// stop-ship proof (parent plan): a mutation whose server response
// failed must NEVER render a success popup — one representative page per
// migrated connector batch, failure injected via route interception so the
// testbed is never mutated and every case reproduces identically forever.
//
//   batch 1  instance update (OAM)      → HTTP 500
//   batch 2  AI API key create          → HTTP 200 + {result:"fail"}  (the
//            reveal dialog must not render around a failure body)
//   batch 3  endpoint create            → HTTP 200 + {result:"fail"}
//   batch 4  snapshot take              → HTTP 200 + an HTML body (the
//            parse-swallow trap — a proxy interstitial on a 2xx)
//   batch 5  VLAN create                → HTTP 200 + {result:"fail"}
//
// Each case also asserts the rendered message is the LOCALIZED mapped text,
// with no raw server prose.
//---------------------------------------------------------
import {Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';

const FAILED_MSG = 'The operation could not be completed.';
const RAW_MARKER = 'pq: boom on node-3';

let instName = '';
let instId = 0;

test.beforeAll(async () => {
	const inst = await activeInstance();
	instName = inst.name;
	instId = inst.id;
});

// Cross-origin request to the OAM → the browser preflights and enforces
// CORS even on fulfilled routes; answer both legs and pass everything else
// through untouched.
function failWith(status: number, body: string, contentType = 'application/json', method = 'POST') {
	return async (route: Route) => {
		const cors = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		};
		if (route.request().method() === 'OPTIONS') {
			await route.fulfill({status: 204, headers: cors});
			return;
		}
		if (route.request().method() !== method) {
			await route.fallback();
			return;
		}
		await route.fulfill({status, headers: {...cors, 'Content-Type': contentType}, body});
	};
}

function allowFetchNoise(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of (4\d\d|500)/i);
}

test('batch 1 — instance update answered 500 shows the localized error, never success', async ({page, consoleGuard}) => {
	allowFetchNoise(consoleGuard);
	await page.route(`**/oam/loxilbs/${instId}`, failWith(500, JSON.stringify({error: RAW_MARKER}), 'application/json', 'PUT'));

	await page.goto('instance');
	const card = page.locator('.MuiCard-root', {hasText: instName}).first();
	await card.locator('button:has([data-testid="SettingsIcon"])').click();
	await expect(dialogTitle(page, 'Modify Instance')).toBeVisible();
	await field(page, 'Description').fill('e2e no-false-success probe');
	await dialogButton(page, 'Apply').click();

	await expect(dialogTitle(page, 'Error')).toBeVisible({timeout: 15_000});
	await expect(dialog(page)).toContainText(FAILED_MSG);
	await expect(dialog(page)).not.toContainText(RAW_MARKER);
	await expect(dialogTitle(page, 'Success')).toBeHidden();
});

test('batch 2 — API key create answered 200 {result:"fail"} never renders the reveal dialog', async ({page, consoleGuard}) => {
	allowFetchNoise(consoleGuard);
	await page.route('**/netlox/v1/config/ai/apikey', failWith(200, JSON.stringify({result: 'fail'})));

	await page.goto(`instance/ai/apikey?name=${instName}`);
	await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: 'New AI API Key'}));
	await field(page, 'Tenant ID').fill('e2e-tenant');
	await dialog(page).getByRole('button', {name: 'Add', exact: true}).click();

	// The one-time reveal dialog must NOT appear around a failure body.
	await expect(page.getByText('Failed to add AI API key.')).toBeVisible({timeout: 15_000});
	await expect(page.getByText(FAILED_MSG)).toBeVisible();
	await expect(dialogTitle(page, 'API Key Created')).toBeHidden();
	await expect(dialogTitle(page, 'API Key Imported')).toBeHidden();
});

test('batch 3 — endpoint create answered 200 {result:"fail"} shows the localized error', async ({page, consoleGuard}) => {
	allowFetchNoise(consoleGuard);
	await page.route('**/netlox/v1/config/endpoint', failWith(200, JSON.stringify({result: 'fail'})));

	await page.goto(`instance/traffic/endpoint?name=${instName}`);
	await openToolbarDialog(page, 'Add', dialog(page).getByRole('heading', {name: /New Endpoint/i}));
	await field(page, 'Host Name').fill('203.0.113.99');
	await field(page, 'Name').fill('e2e-nfs-probe');
	await dialog(page).getByRole('button', {name: /^(Add|Create)$/}).click();

	await expect(page.getByText('Failed to add endpoint.')).toBeVisible({timeout: 15_000});
	await expect(page.getByText(FAILED_MSG)).toBeVisible();
	await expect(dialogTitle(page, 'Success')).toBeHidden();
});

test('batch 4 — snapshot take answered 200 with an HTML body (parse trap) shows the localized error', async ({page, consoleGuard}) => {
	allowFetchNoise(consoleGuard);
	await page.route(`**/oam/instances/${instId}/snapshots`, failWith(200, '<html>proxy interstitial</html>', 'text/html'));

	await page.goto(`instance/maintenance/snapshots?name=${instName}`);
	await expect(page.getByRole('button', {name: 'Take Snapshot'})).toBeVisible();
	await page.getByRole('button', {name: 'Take Snapshot'}).click();
	await expect(dialog(page).getByLabel(/Name/)).toBeVisible();
	await dialog(page).getByLabel(/Name/).fill('e2e-nfs-parse-probe');
	await dialog(page).getByRole('button', {name: 'Take Snapshot'}).click();

	await expect(dialogTitle(page, 'Error')).toBeVisible({timeout: 15_000});
	await expect(dialog(page)).toContainText(FAILED_MSG);
	await expect(dialogTitle(page, 'Success')).toBeHidden();
});

test('batch 5 — VLAN create answered 200 {result:"fail"} shows the localized error', async ({page, consoleGuard}) => {
	allowFetchNoise(consoleGuard);
	await page.route('**/netlox/v1/config/vlan', failWith(200, JSON.stringify({result: 'fail'})));

	await page.goto(`instance/network/vlan?name=${instName}`);
	await openToolbarDialog(page, 'Add', 'New VLAN');
	await field(page, 'VLAN ID').fill('3555');
	await dialogButton(page, 'Add').click();

	await expect(page.getByText('Failed to add VLAN.')).toBeVisible({timeout: 15_000});
	await expect(page.getByText(FAILED_MSG)).toBeVisible();
	await expect(dialogTitle(page, 'Success')).toBeHidden();
});
