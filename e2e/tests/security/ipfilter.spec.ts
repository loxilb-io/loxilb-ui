//---------------------------------------------------------
// IP Filter (XDP) page CRUD spec.
// POST /config/ipfilter (create), DELETE /config/ipfilter?filterType&cidr&zone.
// Safety: every rule targets the RFC-5737 documentation range
// 203.0.113.0/24 — the DOC_IP sweep can only ever match those, so a
// real filter rule (0.0.0.0/0, the OAM host, SSH ranges) is never touched.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepIpFilterRules} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const IPF_PATH = '/config/ipfilter';

//---------------------------------------------------------
// API seed (D fixtures)
//---------------------------------------------------------
interface SeedRule {
	filterType: 'whitelist' | 'blacklist';
	cidr: string;
	action: 'allow' | 'drop';
	zone?: number;
	priority?: number;
}

async function apiCreateRule(rule: SeedRule): Promise<void> {
	const resp = await gw('POST', IPF_PATH, {
		filterType: rule.filterType,
		cidr: rule.cidr,
		action: rule.action,
		zone: rule.zone ?? 0,
		priority: rule.priority ?? 100,
	});
	expect(resp.status, `API seed create ${rule.cidr}`).toBeLessThan(300);
}

//---------------------------------------------------------
// UI helpers
//---------------------------------------------------------
async function openAddDialog(page: Page): Promise<void> {
	await openToolbarDialog(page, 'Add', 'New IP Filter Rule Configuration');
}

/** Records DELETE /config/ipfilter request URLs fired while `action` runs. */
async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(IPF_PATH)) urls.push(new URL(r.url()));
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return urls;
}

//---------------------------------------------------------
// Suite
//---------------------------------------------------------
let instName: string;

test.describe('@gw IP Filter page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepIpFilterRules();
	});

	test.afterEach(async () => {
		await sweepIpFilterRules();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/security/ipfilter?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-white: whitelist/allow rule POSTs clean payload, then D-single', async ({page}) => {
		await openAddDialog(page);
		// Filter Type defaults to whitelist, Action to allow — set only CIDR.
		await field(page, 'CIDR').fill('203.0.113.0/28');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(IPF_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();

		expect(body.filterType).toBe('whitelist');
		expect(body.cidr).toBe('203.0.113.0/28');
		expect(body.action).toBe('allow');
		// The form's onChange validation flag must never ride along into the
		// POST payload.
		expect(body.isValid, 'isValid must not leak into the ipfilter payload').toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted ipfilter create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, '203.0.113.0/28');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.0/28');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 rule(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].searchParams.get('filterType')).toBe('whitelist');
		expect(deletes[0].searchParams.get('cidr')).toBe('203.0.113.0/28');
		await refreshUntilGone(page, '203.0.113.0/28');
	});

	test('C-black: blacklist/drop rule POSTs the chosen enums', async ({page}) => {
		await openAddDialog(page);
		await selectOption(page, 'Filter Type', 'blacklist');
		await selectOption(page, 'Action', 'drop');
		await field(page, 'CIDR').fill('203.0.113.16/28');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(IPF_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({filterType: 'blacklist', cidr: '203.0.113.16/28', action: 'drop'});
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted ipfilter create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, '203.0.113.16/28');
	});

	test('V-bare-ip: a bare host IP is normalized to /32 in the POST and accepted', async ({page}) => {
		await openAddDialog(page);
		// The gateway only parses CIDR notation — a bare IP must reach it as a
		// single-host prefix, not verbatim (which it rejects with a 400).
		await field(page, 'CIDR').fill('203.0.113.55');

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(IPF_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body.cidr, 'bare IP normalized to a host prefix').toBe('203.0.113.55/32');

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted the normalized rule').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, '203.0.113.55/32');
	});

	test('C-full: priority lands in the POST body; zone stays 0 (gateway XDP ipfilter is zone-less)', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'CIDR').fill('203.0.113.32/28');
		await field(page, 'Priority').fill('250');
		// Security Zone is intentionally not offered: the gateway rejects any
		// nonzero zone with 400 ("zone must be 0 or omitted"), so the form pins
		// it to 0. Assert the payload carries the accepted value, not a field
		// the user could set to a guaranteed-400 value.

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(IPF_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();
		expect(body).toMatchObject({cidr: '203.0.113.32/28', priority: 250, zone: 0});
		expect(body.isValid).toBeUndefined();

		const resp = await req.response();
		expect(resp?.status(), 'gateway accepted ipfilter create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, '203.0.113.32/28');
	});

	test('V-cidr: empty, garbage, out-of-range octets and /33 all block submit', async ({page}) => {
		await openAddDialog(page);
		const addBtn = dialogButton(page, 'Add');

		// Empty CIDR (initial state) → blocked.
		expect(await isEventuallyDisabled(addBtn), 'empty CIDR must block').toBe(true);

		// Valid baseline enables submit.
		await field(page, 'CIDR').fill('203.0.113.0/28');
		await expect(addBtn).toBeEnabled();

		// Garbage → blocked.
		await field(page, 'CIDR').fill('not-a-cidr');
		expect(await isEventuallyDisabled(addBtn), 'garbage CIDR must block').toBe(true);

		// Out-of-range octet (old regex accepted this) → blocked.
		await field(page, 'CIDR').fill('999.1.1.1');
		expect(await isEventuallyDisabled(addBtn), 'out-of-range octet must block').toBe(true);

		// Prefix > 32 (old regex accepted /33) → blocked.
		await field(page, 'CIDR').fill('203.0.113.0/33');
		expect(await isEventuallyDisabled(addBtn), 'prefix /33 must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});

	test('V-pairing: whitelist+drop and blacklist+allow are blocked (gateway couples type↔action)', async ({page}) => {
		await openAddDialog(page);
		const addBtn = dialogButton(page, 'Add');
		await field(page, 'CIDR').fill('203.0.113.208/28');
		// whitelist defaults to allow → valid baseline.
		await expect(addBtn).toBeEnabled();

		// Force the invalid whitelist+drop pairing.
		await selectOption(page, 'Action', 'drop');
		expect(await isEventuallyDisabled(addBtn), 'whitelist+drop must block').toBe(true);

		// Switching to blacklist auto-corrects action to drop → valid again.
		await selectOption(page, 'Filter Type', 'blacklist');
		await expect(addBtn).toBeEnabled();

		// Force the invalid blacklist+allow pairing.
		await selectOption(page, 'Action', 'allow');
		expect(await isEventuallyDisabled(addBtn), 'blacklist+allow must block').toBe(true);

		await dialogButton(page, 'Cancel').click();
	});

	test('D-multi: bulk delete fires one DELETE per selected rule', async ({page}) => {
		await apiCreateRule({filterType: 'whitelist', cidr: '203.0.113.64/28', action: 'allow'});
		await apiCreateRule({filterType: 'blacklist', cidr: '203.0.113.80/28', action: 'drop'});
		await apiCreateRule({filterType: 'whitelist', cidr: '203.0.113.96/28', action: 'allow'});

		await refreshUntilRow(page, '203.0.113.64/28');
		await refreshUntilRow(page, '203.0.113.96/28');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.64/28');
			await selectRowByText(page, '203.0.113.80/28');
			await selectRowByText(page, '203.0.113.96/28');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 rule(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes, 'one DELETE per selected rule').toHaveLength(3);
		const cidrs = deletes.map(u => u.searchParams.get('cidr')).sort();
		expect(cidrs).toEqual(['203.0.113.64/28', '203.0.113.80/28', '203.0.113.96/28']);
		await refreshUntilGone(page, /203\.0\.113\.(64|80|96)\/28/);
	});
});
