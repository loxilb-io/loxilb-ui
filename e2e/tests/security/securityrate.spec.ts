//---------------------------------------------------------
// Security Rate Limiting (XDP) page spec (docs/E2E_CRUD_TEST_PLAN.md §4.3).
// Edit-only page: POST /config/securityrate configures one unified policy
// (SYN flood + connection rate + UDP flood). Read-modify-restore: the real
// pre-test config is captured in beforeAll and restored in afterAll.
//
// Safety: inert-high thresholds (200000+ per IP) + a 10.0.0.0/24 whitelist
// keep the mgmt path clear; UDP protection is left disabled.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {grid, toolbarButton} from '../../helpers/table';

const SR_PATH = '/config/securityrate';

interface RateConfig {
	synEnabled: boolean;
	synThreshold: number;
	cookieThreshold: number;
	connRateEnabled: boolean;
	ratePerSec: number;
	concurrentLimit: number;
	udpEnabled: boolean;
	udpPktThreshold: number;
	udpBandwidthMB: number;
	whitelistIps?: string[];
}

const RATE_KEYS: (keyof RateConfig)[] = [
	'synEnabled', 'synThreshold', 'cookieThreshold',
	'connRateEnabled', 'ratePerSec', 'concurrentLimit',
	'udpEnabled', 'udpPktThreshold', 'udpBandwidthMB', 'whitelistIps',
];

async function readConfig(): Promise<RateConfig | null> {
	const data = await gwJson<{securityrateAttr?: RateConfig[]}>(`${SR_PATH}/all`);
	const cur = data.securityrateAttr?.[0];
	if (!cur) return null;
	// The gateway omits false booleans (omitempty); coalesce the three enable
	// flags so the restore POST in afterAll always carries them.
	const bools = new Set<keyof RateConfig>(['synEnabled', 'connRateEnabled', 'udpEnabled']);
	const out: any = {};
	for (const k of RATE_KEYS) {
		if (k === 'whitelistIps') out[k] = cur.whitelistIps ?? [];
		else if (bools.has(k)) out[k] = (cur as any)[k] ?? false;
		else out[k] = (cur as any)[k];
	}
	return out as RateConfig;
}

/** Inert-high baseline: guarantees a row and is safe on the mgmt path. */
const BASELINE: RateConfig = {
	synEnabled: true, synThreshold: 200000, cookieThreshold: 100000,
	connRateEnabled: true, ratePerSec: 100000, concurrentLimit: 200000,
	udpEnabled: false, udpPktThreshold: 1000000, udpBandwidthMB: 100000,
	whitelistIps: ['10.0.0.0/24'],
};

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
let original: RateConfig | null;

test.describe('Security Rate Limiting page (edit-only)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		original = await readConfig();
		await gw('POST', SR_PATH, BASELINE);
	});

	test.afterAll(async () => {
		if (original) {
			await gw('POST', SR_PATH, original);
		} else {
			await gw('DELETE', SR_PATH);
		}
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/security/securityrate?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
		await refreshUntilAnyRow(page);
	});

	async function openEditDialog(page: Page): Promise<void> {
		await selectOnlyRow(page);
		await toolbarButton(page, 'Mode').click();
		await expect(dialog(page).getByText('New Security Rate Limiting Configuration')).toBeVisible();
	}

	test('E-edit: changing the SYN threshold POSTs the full config clean and persists', async ({page}) => {
		await openEditDialog(page);

		// The dialog opens pre-filled from the seeded baseline (all sections on
		// except UDP). Nudge the SYN threshold to prove the round-trip.
		await field(page, 'SYN Threshold').fill('201000');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(SR_PATH) && !r.url().includes('/all')),
			dialogButton(page, 'Configure').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({
			synEnabled: true,
			synThreshold: 201000,
			cookieThreshold: 100000,
			connRateEnabled: true,
			ratePerSec: 100000,
			concurrentLimit: 200000,
			udpEnabled: false,
			whitelistIps: ['10.0.0.0/24'],
		});
		// F24-family regression: validation flag must not leak into the payload.
		expect(body.isValid, 'isValid must not leak into the securityrate payload').toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted securityrate configure').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		const after = await readConfig();
		expect(after?.synEnabled).toBe(true);
		expect(after?.synThreshold).toBe(201000);
	});

	test('V-thresholds: cookie ≥ syn blocks submit', async ({page}) => {
		await openEditDialog(page);
		const configureBtn = dialogButton(page, 'Configure');
		await expect(configureBtn).toBeEnabled();

		// cookieThreshold ≥ synThreshold → invalid.
		await field(page, 'Cookie Threshold').fill('300000');
		expect(await isEventuallyDisabled(configureBtn), 'cookie ≥ syn must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});
});
