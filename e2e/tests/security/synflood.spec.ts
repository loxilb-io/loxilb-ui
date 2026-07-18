//---------------------------------------------------------
// SYN Flood Protection (XDP) page spec (docs/E2E_CRUD_TEST_PLAN.md §4.2).
// Edit-only page: POST /config/synflood configures a single global policy.
// Read-modify-restore: the true pre-test config is captured in beforeAll
// and restored in afterAll, so the testbed is left exactly as found.
//
// Safety: the test config uses inert-high thresholds (200000 SYN/s per IP,
// far above any real traffic) and whitelists 10.0.0.0/24, so the mgmt path
// (OAM ↔ gateway) is never rate-limited while the test runs.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {grid, toolbarButton} from '../../helpers/table';

const SF_PATH = '/config/synflood';

interface SynFloodConfig {
	enabled: boolean;
	synThreshold: number;
	cookieThreshold: number;
	whitelistIps?: string[];
}

/** Current gateway config (first synfloodAttr entry), or null if unset. */
async function readConfig(): Promise<SynFloodConfig | null> {
	const data = await gwJson<{synfloodAttr?: SynFloodConfig[]}>(`${SF_PATH}/all`);
	const cur = data.synfloodAttr?.[0];
	if (!cur) return null;
	return {
		// The gateway omits `enabled` when false (omitempty); coalesce so the
		// restore POST in afterAll always carries the required boolean.
		enabled: cur.enabled ?? false,
		synThreshold: cur.synThreshold,
		cookieThreshold: cur.cookieThreshold,
		whitelistIps: cur.whitelistIps ?? [],
	};
}

/** A disabled baseline that guarantees a selectable row for the edit flow. */
const BASELINE: SynFloodConfig = {enabled: false, synThreshold: 100, cookieThreshold: 50, whitelistIps: []};

/** Selects the single global-config row so the Edit (Mode) button enables. */
async function selectOnlyRow(page: Page): Promise<void> {
	const row = grid(page).locator('.MuiDataGrid-row').first();
	await expect(row).toBeVisible();
	await row.getByRole('checkbox').check();
}

async function refreshUntilAnyRow(page: Page): Promise<void> {
	for (let i = 0; i < 5; i++) {
		if ((await grid(page).locator('.MuiDataGrid-row').count()) > 0) return;
		await toolbarButton(page, 'Refresh').click();
		await page.waitForTimeout(1500);
	}
	await expect(grid(page).locator('.MuiDataGrid-row').first()).toBeVisible();
}

//---------------------------------------------------------
// Suite
//---------------------------------------------------------
let instName: string;
let original: SynFloodConfig | null;

test.describe('SYN Flood Protection page (edit-only)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		original = await readConfig();
		// Seed a disabled baseline so the page always has a row to edit.
		await gw('POST', SF_PATH, BASELINE);
	});

	test.afterAll(async () => {
		// Restore the exact pre-test state (or disable if there was none).
		if (original) {
			await gw('POST', SF_PATH, original);
		} else {
			await gw('DELETE', SF_PATH);
		}
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/security/synflood?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
		await refreshUntilAnyRow(page);
	});

	async function openEditDialog(page: Page): Promise<void> {
		await selectOnlyRow(page);
		await toolbarButton(page, 'Mode').click();
		await expect(dialog(page).getByText('New SYN Flood Protection Configuration')).toBeVisible();
	}

	test('E-edit: enabling with inert-high thresholds POSTs a clean payload and persists', async ({page}) => {
		await openEditDialog(page);

		// Toggle protection on, then fill the now-visible thresholds.
		await dialog(page).getByRole('checkbox', {name: 'Enable SYN Flood Protection'}).check();
		await field(page, 'SYN Threshold').fill('200000');
		await field(page, 'Cookie Threshold').fill('100000'); // must stay < synThreshold
		await field(page, 'Whitelist IPs (comma-separated)').fill('10.0.0.0/24');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(SF_PATH) && !r.url().includes('/all')),
			dialogButton(page, 'Configure').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({
			enabled: true,
			synThreshold: 200000,
			cookieThreshold: 100000,
			whitelistIps: ['10.0.0.0/24'],
		});
		// F24-family regression: validation flag must not leak into the payload.
		expect(body.isValid, 'isValid must not leak into the synflood payload').toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted synflood configure').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		// Persisted round-trip via the API.
		const after = await readConfig();
		expect(after?.enabled).toBe(true);
		expect(after?.synThreshold).toBe(200000);
	});

	test('V-thresholds: cookie ≥ syn and negative values block submit', async ({page}) => {
		await openEditDialog(page);
		const configureBtn = dialogButton(page, 'Configure');

		await dialog(page).getByRole('checkbox', {name: 'Enable SYN Flood Protection'}).check();
		// Valid baseline first (syn 200000 > cookie 100000).
		await field(page, 'SYN Threshold').fill('200000');
		await field(page, 'Cookie Threshold').fill('100000');
		await expect(configureBtn).toBeEnabled();

		// cookieThreshold ≥ synThreshold → invalid.
		await field(page, 'Cookie Threshold').fill('200000');
		expect(await isEventuallyDisabled(configureBtn), 'cookie ≥ syn must block').toBe(true);

		// Negative synThreshold → invalid.
		await field(page, 'Cookie Threshold').fill('100000');
		await field(page, 'SYN Threshold').fill('-5');
		expect(await isEventuallyDisabled(configureBtn), 'negative threshold must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});
});
