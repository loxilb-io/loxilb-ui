//---------------------------------------------------------
// Instances page spec.
//   • dashboard widgets render on the instance card
//   • "Check Health" round-trips (a /version probe fires; card resolves)
//   • the Modify dialog rejects a bad port / empty host WITHOUT mutating —
//     Apply is gated on validity now (F-INSTANCE-1). No create/delete of the
//     real instance ever happens.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, Instance} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';

let inst: Instance;
let instName: string;

test.beforeAll(async () => {
	inst = await activeInstance();
	instName = inst.name;
});

function card(page: Page) {
	return page.locator('.MuiCard-root').filter({hasText: instName});
}

test.describe('Instances page', () => {
	test.beforeEach(async ({page}) => {
		await page.goto('instance');
		await expect(card(page)).toBeVisible({timeout: 20_000});
	});

	test('dashboard widgets render and Check Health round-trips', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of \d{3}/i);

		const c = card(page);
		for (const label of ['Host', 'Version', 'HA State', 'Health Status', 'Activation Status']) {
			await expect(c.getByText(label, {exact: true})).toBeVisible();
		}

		const probes: string[] = [];
		const cap = (r: any) => {
			if (r.method() === 'GET' && /\/version(\?|$)/.test(r.url())) probes.push(r.url());
		};
		page.on('request', cap);
		try {
			// The button's accessible name is its Tooltip ("Refresh instance health
			// status"); target it by its visible label instead.
			await page.locator('button:has-text("Check Health")').click();
			await expect(c.getByText('Healthy')).toBeVisible({timeout: 20_000});
		} finally {
			page.off('request', cap);
		}
		expect(probes.length, 'a /version health probe fired').toBeGreaterThan(0);
	});

	test('Modify dialog rejects bad port / empty host without mutating (F-INSTANCE-1)', async ({page}) => {
		const mutations: string[] = [];
		const cap = (r: any) => {
			if (['PUT', 'POST', 'DELETE'].includes(r.method()) && /\/loxilbs\//.test(r.url())) mutations.push(`${r.method()} ${r.url()}`);
		};
		page.on('request', cap);
		try {
			await card(page).locator('button:has([data-testid="SettingsIcon"])').click();
			await expect(dialogTitle(page, 'Modify Instance')).toBeVisible();
			const apply = dialogButton(page, 'Apply');
			await expect(apply, 'prefilled instance data is valid').toBeEnabled();

			// Out-of-range port → field error + Apply gated off.
			await field(page, 'Port').fill('99999');
			await expect(dialog(page).getByText('Invalid port number.')).toBeVisible();
			expect(await isEventuallyDisabled(apply)).toBe(true);

			// Restore port, then empty host → Apply gated off again.
			await field(page, 'Port').fill(String(inst.port ?? 8091));
			await expect(apply).toBeEnabled();
			await field(page, 'Host').fill('');
			expect(await isEventuallyDisabled(apply)).toBe(true);

			await dialogButton(page, 'Cancel').click();
			await expect(dialog(page)).toBeHidden();
		} finally {
			page.off('request', cap);
		}
		expect(mutations, 'a validation-only edit must not mutate the instance').toEqual([]);
	});
});
