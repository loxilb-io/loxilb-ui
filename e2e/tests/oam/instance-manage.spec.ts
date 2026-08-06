//---------------------------------------------------------
// Multi-instance management on the Instances page: the Add card
// (re-enabled), the form's validation gates, and the create →
// modify → delete round trip.
//
// Safety: every instance this spec registers is marked (e2e- name AND a
// documentation-range host per RFC 5737), so the sweep in zz-cleanup can
// never touch the real testbed instance the rest of the suite depends on.
// A registration is only a DB row — nothing is launched — but the page
// health-probes it, and probing a documentation IP fails by design, so
// the console guard allows those failures.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {createInstanceApi, deleteInstanceApi, findInstanceByName, listInstances} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';

const NAME = 'e2e-instance-a';
const NAME_B = 'e2e-instance-b';
const HOST = '203.0.113.41';
const HOST_B = '203.0.113.42';
const PORT = '18091';

// Probing an unroutable documentation address is the point of using one.
function allowDeadHostNoise(consoleGuard: {allow: (p: RegExp) => void}): void {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of \d{3}/i);
	consoleGuard.allow(/ERR_(CONNECTION|ADDRESS|NETWORK|TIMED_OUT|NAME_NOT_RESOLVED)/i);
	consoleGuard.allow(/Failed to fetch/i);
	consoleGuard.allow(/AxiosError/i);
}

async function removeMarked(): Promise<void> {
	for (const inst of await listInstances()) {
		if (inst.name.startsWith('e2e-')) await deleteInstanceApi(inst.id);
	}
}

function addCard(page: Page) {
	return page.locator('.MuiCard-root').filter({hasText: 'Add New Instance'});
}

function card(page: Page, name: string) {
	return page.locator('.MuiCard-root').filter({hasText: name});
}

/** Opens the Add dialog and fills a complete, valid registration. */
async function openAddAndFill(page: Page, values: {name: string; host: string; port: string; protocol?: 'HTTP' | 'HTTPS'}): Promise<void> {
	await addCard(page).click();
	await expect(dialogTitle(page, 'Add New Instance')).toBeVisible();
	await field(page, 'Name').fill(values.name);
	await field(page, 'Host').fill(values.host);
	await field(page, 'Port').fill(values.port);
	if (values.protocol) await selectOption(page, 'Protocol', values.protocol);
}

test.describe.serial('Instances — multi-instance management', () => {
	test.beforeAll(async () => {
		await removeMarked();
	});

	test.afterAll(async () => {
		await removeMarked();
	});

	test.beforeEach(async ({page}) => {
		await page.goto('instance');
		await expect(addCard(page)).toBeVisible({timeout: 20_000});
	});

	test('the Add card is present for an admin and opens the registration form', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		await addCard(page).click();
		await expect(dialogTitle(page, 'Add New Instance')).toBeVisible();

		// Create stays disabled until the operator supplies the fields that
		// have no sane default (name, host).
		const create = dialogButton(page, 'Create');
		expect(await isEventuallyDisabled(create)).toBe(true);

		// The derived endpoint is shown, because it — not the four inputs —
		// is what OAM will proxy to.
		await field(page, 'Name').fill(NAME);
		await field(page, 'Host').fill(HOST);
		await field(page, 'Port').fill(PORT);
		await expect(dialog(page).getByText(`https://${HOST}:${PORT}/netlox/v1`)).toBeVisible();
		await expect(create).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
		await expect(dialog(page)).toBeHidden();
		expect(await findInstanceByName(NAME), 'Cancel must not register anything').toBeUndefined();
	});

	test('field validation gates Create and explains each mistake', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		const mutations: string[] = [];
		const cap = (r: any) => {
			if (r.method() === 'POST' && /\/loxilbs$/.test(r.url())) mutations.push(r.url());
		};
		page.on('request', cap);

		try {
			await openAddAndFill(page, {name: NAME, host: HOST, port: PORT});
			const create = dialogButton(page, 'Create');
			await expect(create).toBeEnabled();

			// A pasted URL is the most common host mistake — it must say so.
			await field(page, 'Host').fill('https://203.0.113.41');
			await expect(dialog(page).getByText(/no scheme/i)).toBeVisible();
			expect(await isEventuallyDisabled(create)).toBe(true);

			// host:port in the host field.
			await field(page, 'Host').fill('203.0.113.41:8091');
			await expect(dialog(page).getByText(/port in the Port field/i)).toBeVisible();
			expect(await isEventuallyDisabled(create)).toBe(true);

			// Bare IPv6 would produce an unparseable endpoint authority.
			await field(page, 'Host').fill('2001:db8::1');
			await expect(dialog(page).getByText(/brackets/i)).toBeVisible();
			expect(await isEventuallyDisabled(create)).toBe(true);

			await field(page, 'Host').fill(HOST);
			await expect(create).toBeEnabled();

			// Out-of-range port.
			await field(page, 'Port').fill('99999');
			await expect(dialog(page).getByText('Invalid port number.')).toBeVisible();
			expect(await isEventuallyDisabled(create)).toBe(true);
			await field(page, 'Port').fill(PORT);
			await expect(create).toBeEnabled();

			// A name that would need URL-escaping in ?name=.
			await field(page, 'Name').fill('bad name');
			expect(await isEventuallyDisabled(create)).toBe(true);
			await field(page, 'Name').fill(NAME);
			await expect(create).toBeEnabled();

			// A tag pasted into the image field.
			await field(page, 'Container Image').fill('ghcr.io/loxilb-io/loxilb:latest');
			await expect(dialog(page).getByText(/tag in the Tag field/i)).toBeVisible();
			expect(await isEventuallyDisabled(create)).toBe(true);
			await field(page, 'Container Image').fill('ghcr.io/loxilb-io/loxilb');
			await expect(create).toBeEnabled();

			// Version is a path segment — traversal must not be submittable.
			await field(page, 'Version').fill('../../config');
			expect(await isEventuallyDisabled(create)).toBe(true);

			await dialogButton(page, 'Cancel').click();
			await expect(dialog(page)).toBeHidden();
		} finally {
			page.off('request', cap);
		}

		expect(mutations, 'a validation-only session must never POST').toEqual([]);
	});

	test('registers a second instance and lists it alongside the existing one', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		const before = (await listInstances()).length;

		await openAddAndFill(page, {name: NAME, host: HOST, port: PORT, protocol: 'HTTP'});
		await dialogButton(page, 'Create').click();
		await expectSuccessAndDismiss(page);

		// Registered exactly as entered — protocol included (the endpoint is
		// derived from it server-side).
		const created = await findInstanceByName(NAME);
		expect(created, 'instance registered').toBeDefined();
		expect(created!.api_endpoint).toBe(`http://${HOST}:${PORT}/netlox/v1`);
		expect(created!.protocol).toBe('http');
		expect((await listInstances()).length).toBe(before + 1);

		// And the page shows it as a card next to the real instance.
		await expect(card(page, NAME)).toBeVisible({timeout: 20_000});
		// exact — the same text also appears inside the API-endpoint row.
		await expect(card(page, NAME).getByText(`${HOST}:${PORT}`, {exact: true})).toBeVisible();
	});

	test('refuses a duplicate name and a duplicate endpoint', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		// Seeded via the API so the check under test is the UI's, not a
		// side-effect of the previous test's dialog state. Create only when
		// absent: what a backend answers for a duplicate is itself
		// version-dependent (409 once the conflict handling lands, a raw 500
		// from the UNIQUE constraint before it), and this test is about the
		// UI's refusal, so it must not depend on that.
		if (!(await findInstanceByName(NAME))) {
			const seeded = await createInstanceApi({name: NAME, host: HOST, port: PORT, protocol: 'http', version: 'v1', cimage: 'ghcr.io/loxilb-io/loxilb', ctag: 'latest'});
			expect(seeded.ok, `seeding ${NAME} failed: ${seeded.status}`).toBe(true);
		}
		expect(await findInstanceByName(NAME), 'conflict target is registered').toBeDefined();
		await page.reload();
		await expect(card(page, NAME)).toBeVisible({timeout: 20_000});

		await openAddAndFill(page, {name: NAME, host: HOST_B, port: PORT});
		// Same name → the UI would route ?name= to whichever came first.
		await expect(dialog(page).getByText(/already exists/i)).toBeVisible();
		expect(await isEventuallyDisabled(dialogButton(page, 'Create'))).toBe(true);

		// Distinct name, same protocol/host/port/version → same derived
		// endpoint, which is UNIQUE in the schema.
		await field(page, 'Name').fill(NAME_B);
		await field(page, 'Host').fill(HOST);
		await selectOption(page, 'Protocol', 'HTTP');
		await expect(dialog(page).getByText(/already registered at/i)).toBeVisible();
		expect(await isEventuallyDisabled(dialogButton(page, 'Create'))).toBe(true);

		// Changing the port frees the endpoint again.
		await field(page, 'Port').fill('18092');
		await expect(dialog(page).getByText(/already registered at/i)).toBeHidden();
		await expect(dialogButton(page, 'Create')).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
		await expect(dialog(page)).toBeHidden();
	});

	test('Modify keeps the protocol it was opened with (F-INSTANCE-2)', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		// An http instance whose only edit is the description must stay http:
		// the dialog used to omit protocol, so the form defaulted to https and
		// OAM re-derived an https endpoint against a plaintext port.
		const before = await findInstanceByName(NAME);
		expect(before?.protocol).toBe('http');

		await card(page, NAME).locator('button:has([data-testid="SettingsIcon"])').click();
		await expect(dialogTitle(page, 'Modify Instance')).toBeVisible();
		await expect(dialog(page).getByRole('combobox', {name: /^Protocol/})).toHaveText(/HTTP$/);
		await expect(dialog(page).getByText(`http://${HOST}:${PORT}/netlox/v1`)).toBeVisible();

		await field(page, 'Description').fill('edited by e2e');
		await dialogButton(page, 'Apply').click();
		await expectSuccessAndDismiss(page);

		const after = await findInstanceByName(NAME);
		expect(after?.protocol, 'protocol survives an unrelated edit').toBe('http');
		expect(after?.api_endpoint).toBe(`http://${HOST}:${PORT}/netlox/v1`);
		expect(after?.description).toBe('edited by e2e');
	});

	test('re-saving an instance unchanged is not a self-conflict', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		await card(page, NAME).locator('button:has([data-testid="SettingsIcon"])').click();
		await expect(dialogTitle(page, 'Modify Instance')).toBeVisible();
		// Its own name and endpoint are excluded from the uniqueness checks.
		await expect(dialog(page).getByText(/already exists|already registered at/i)).toBeHidden();
		await expect(dialogButton(page, 'Apply')).toBeEnabled();

		await dialogButton(page, 'Apply').click();
		await expectSuccessAndDismiss(page);
		expect(await findInstanceByName(NAME)).toBeDefined();
	});

	test('deletes the registration and drops the card', async ({page, consoleGuard}) => {
		allowDeadHostNoise(consoleGuard);

		await expect(card(page, NAME)).toBeVisible({timeout: 20_000});
		await card(page, NAME).locator('button:has([data-testid="DeleteForeverIcon"])').click();
		await expect(dialogTitle(page, 'WARNING!! Delete Instance')).toBeVisible();
		await dialogButton(page, 'Delete').click();
		await expectSuccessAndDismiss(page);

		expect(await findInstanceByName(NAME), 'registration removed').toBeUndefined();
		await expect(card(page, NAME)).toBeHidden({timeout: 20_000});
	});
});
