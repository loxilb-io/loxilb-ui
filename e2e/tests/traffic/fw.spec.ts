//---------------------------------------------------------
// Firewall page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §1.2).
// POST/DELETE /config/firewall, payload {ruleArguments, opts}.
// Every entity uses reserved-documentation IPs so strays are
// identifiable and inert; the afterAll sweep removes leftovers.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, firewallDeleteQuery, gw, sweepFirewallRules} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, dialogTitle, expectErrorAndDismiss, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {refreshUntilGone, refreshUntilRow, rowByText, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

const FW_PATH = '/config/firewall';

//---------------------------------------------------------
// API-level seed/sweep (cleanup + D-case fixtures)
//---------------------------------------------------------
interface SeedArgs {
	sourceIP: string;
	destinationIP: string;
	protocol?: number;
	preference?: number;
}

function seedRule(args: SeedArgs) {
	return {
		ruleArguments: {
			sourceIP: args.sourceIP,
			destinationIP: args.destinationIP,
			protocol: args.protocol ?? 6,
			preference: args.preference ?? 0,
		},
		opts: {drop: true},
	};
}

async function apiCreate(rule: object): Promise<void> {
	const resp = await gw('POST', FW_PATH, rule);
	expect(resp.status, 'API seed create').toBeLessThan(300);
}


//---------------------------------------------------------
// UI interaction helpers
//---------------------------------------------------------
interface UiRuleArgs {
	sourceIP?: string;
	destinationIP?: string;
	srcPortMin?: string;
	srcPortMax?: string;
	dstPortMin?: string;
	dstPortMax?: string;
	protocolOption?: string; // e.g. 'TCP(6)'
	portName?: string;
	preference?: string;
	hwOffload?: boolean;
}

interface UiOpts {
	allow?: boolean;
	drop?: boolean;
	trap?: boolean;
	record?: boolean;
	redirect?: boolean;
	redirectPortName?: string;
	doSnat?: boolean;
	toIP?: string;
	toPort?: string;
	fwMark?: string;
	onDefault?: boolean;
}

/**
 * ParamBox wraps every control in a Tooltip whose description becomes an
 * aria-label on the wrapper div — a bare getByLabel substring lookup matches
 * both. Anchored regex (with the optional required-` *` suffix) hits only the
 * real control's label.
 */
function field(page: Page, label: string) {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return dialog(page).getByLabel(new RegExp(`^${escaped}( \\*)?$`));
}

async function fillRuleForm(page: Page, args: UiRuleArgs, opts: UiOpts = {}): Promise<void> {
	if (args.sourceIP !== undefined) await field(page, 'Source IP').fill(args.sourceIP);
	if (args.destinationIP !== undefined) await field(page, 'Destination IP').fill(args.destinationIP);
	// "Port Min"/"Port Max" appear twice: nth(0)=source, nth(1)=destination.
	if (args.srcPortMin !== undefined) await field(page, 'Port Min').nth(0).fill(args.srcPortMin);
	if (args.srcPortMax !== undefined) await field(page, 'Port Max').nth(0).fill(args.srcPortMax);
	if (args.dstPortMin !== undefined) await field(page, 'Port Min').nth(1).fill(args.dstPortMin);
	if (args.dstPortMax !== undefined) await field(page, 'Port Max').nth(1).fill(args.dstPortMax);
	if (args.protocolOption !== undefined) await selectOption(page, 'Protocol', args.protocolOption);
	// "Port Name" appears twice: nth(0)=ruleArguments.portName, nth(1)=redirectPortName.
	if (args.portName !== undefined) await field(page, 'Port Name').nth(0).fill(args.portName);
	if (args.preference !== undefined) await field(page, 'Preference').fill(args.preference);
	if (args.hwOffload) await field(page, 'HW Offload').check();

	if (opts.allow) await field(page, 'Allow').check();
	if (opts.drop) await field(page, 'Drop').check();
	if (opts.trap) await field(page, 'Trap').check();
	if (opts.record) await field(page, 'Record').check();
	if (opts.redirect) await field(page, 'Redirect').check();
	if (opts.redirectPortName !== undefined) await field(page, 'Port Name').nth(1).fill(opts.redirectPortName);
	if (opts.doSnat) await field(page, 'Do SNAT').check();
	if (opts.toIP !== undefined) await field(page, 'To IP').fill(opts.toIP);
	if (opts.toPort !== undefined) await field(page, 'To Port').fill(opts.toPort);
	if (opts.fwMark !== undefined) await field(page, 'fwMark').fill(opts.fwMark);
	if (opts.onDefault) await field(page, 'On Default').check();
}

/** Opens Add, fills the form, submits, asserts 2xx + Success popup; returns the POST body. */
async function createViaUI(page: Page, args: UiRuleArgs, opts: UiOpts = {}): Promise<any> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('Firewall Rule Arguments')).toBeVisible();
	await fillRuleForm(page, args, opts);

	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().includes(FW_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	const resp = await req.response();
	expect(resp?.status(), 'gateway accepted create').toBeLessThan(300);
	await expectSuccessAndDismiss(page);
	return req.postDataJSON();
}

/** Validation state settles asynchronously after the last keystroke. */
async function isEventuallyDisabled(btn: import('@playwright/test').Locator): Promise<boolean> {
	try {
		await expect(btn).toBeDisabled({timeout: 3000});
		return true;
	} catch {
		return false;
	}
}

/** Records DELETE /config/firewall request URLs fired while `action` runs. */
async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(FW_PATH)) urls.push(new URL(r.url()));
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

test.describe('Firewall page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepFirewallRules(); // start from a clean slate
	});

	// Safety net, not an assertion: each test's own cleanup is exercised
	// where it matters (D-cases); the strict run-wide leak check lives in
	// the final zz-cleanup spec.
	test.afterEach(async () => {
		await sweepFirewallRules();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/fw?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: create with required fields + drop, delete again', async ({page}) => {
		const body = await createViaUI(
			page,
			{sourceIP: '203.0.113.1/32', destinationIP: '198.51.100.1/32'},
			{drop: true},
		);

		expect(body.ruleArguments.sourceIP).toBe('203.0.113.1/32');
		expect(body.ruleArguments.destinationIP).toBe('198.51.100.1/32');
		// ParamBox auto-selects the first protocol option, ICMP(1).
		expect(body.ruleArguments.protocol).toBe(1);
		expect(body.opts.drop).toBe(true);
		expect(body.opts.allow).toBeFalsy();
		// No spurious client-side keys may leak into the payload.
		expect(Object.keys(body).sort()).toEqual(['opts', 'ruleArguments']);

		await refreshUntilRow(page, '203.0.113.1');

		// Row-scoped D-single via UI closes the loop for this entity.
		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.1');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expectSuccessAndDismiss(page);
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].searchParams.get('sourceIP')).toContain('203.0.113.1');
		await refreshUntilGone(page, '203.0.113.1');
	});

	test('C-args-full: every ruleArguments field lands in the POST body', async ({page, consoleGuard}) => {
		// KNOWN GATEWAY BUG (found 2026-07-19): a firewall rule created with
		// min/max port ranges can never be deleted again — every DELETE
		// (full tuple, partial, via UI or API) returns 404 "no-rule error",
		// while range-less rules delete fine. Until the gateway is fixed, the
		// ranged rule from the first run persists, so a rerun's identical
		// create gets 409 Conflict. Both outcomes prove what this case is
		// for — the UI payload — so both are accepted, and the app must stay
		// healthy either way.
		consoleGuard.allow(/status of 409/);

		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('Firewall Rule Arguments')).toBeVisible();
		await fillRuleForm(
			page,
			{
				sourceIP: '203.0.113.2/32',
				destinationIP: '198.51.100.2/32',
				srcPortMin: '1000',
				srcPortMax: '2000',
				dstPortMin: '8000',
				dstPortMax: '8010',
				protocolOption: 'TCP(6)',
				preference: '201',
			},
			{drop: true},
		);

		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(FW_PATH)),
			dialogButton(page, 'Add').click(),
		]);
		const body = req.postDataJSON();

		expect(body.ruleArguments).toMatchObject({
			sourceIP: '203.0.113.2/32',
			destinationIP: '198.51.100.2/32',
			minSourcePort: 1000,
			maxSourcePort: 2000,
			minDestinationPort: 8000,
			maxDestinationPort: 8010,
			protocol: 6,
			preference: 201,
		});

		const status = (await req.response())?.status() ?? 0;
		expect([200, 204, 409], 'created, or 409 from the undeletable leftover of a previous run').toContain(status);
		if (status === 409) {
			await expectErrorAndDismiss(page);
		} else {
			await expectSuccessAndDismiss(page);
		}
		await refreshUntilRow(page, '203.0.113.2');
	});

	test('C-act-allow / C-act-trap / C-act-record: action flags are exclusive, record combines', async ({page}) => {
		const allowBody = await createViaUI(
			page,
			{sourceIP: '203.0.113.3/32', destinationIP: '198.51.100.3/32', preference: '203'},
			{allow: true},
		);
		expect(allowBody.opts).toMatchObject({allow: true});
		expect(allowBody.opts.drop).toBeFalsy();

		const trapBody = await createViaUI(
			page,
			{sourceIP: '203.0.113.4/32', destinationIP: '198.51.100.4/32', preference: '204'},
			{trap: true},
		);
		expect(trapBody.opts).toMatchObject({trap: true});

		const recordBody = await createViaUI(
			page,
			{sourceIP: '203.0.113.5/32', destinationIP: '198.51.100.5/32', preference: '205'},
			{allow: true, record: true},
		);
		expect(recordBody.opts).toMatchObject({allow: true, record: true});

		await refreshUntilRow(page, '203.0.113.5');
	});

	test('C-redirect: redirect flag + redirect port name', async ({page}) => {
		const body = await createViaUI(
			page,
			{sourceIP: '203.0.113.6/32', destinationIP: '198.51.100.6/32', preference: '206'},
			{redirect: true, redirectPortName: 'lo'},
		);
		expect(body.opts).toMatchObject({redirect: true, redirectPortName: 'lo'});
	});

	test('C-snat: doSnat + toIP + toPort', async ({page}) => {
		const body = await createViaUI(
			page,
			{sourceIP: '203.0.113.7/32', destinationIP: '198.51.100.7/32', preference: '207'},
			{doSnat: true, toIP: '198.51.100.77', toPort: '8080'},
		);
		expect(body.opts).toMatchObject({doSnat: true, toIP: '198.51.100.77', toPort: 8080});
	});

	test('C-mark: fwMark + onDefault (allow action — inert on default path)', async ({page}) => {
		const body = await createViaUI(
			page,
			{sourceIP: '203.0.113.8/32', destinationIP: '198.51.100.8/32', preference: '208'},
			{allow: true, fwMark: '7777', onDefault: true},
		);
		expect(body.opts).toMatchObject({allow: true, fwMark: 7777, onDefault: true});
	});

	test('V-cidr: /33 prefix must not create a rule', async ({page, consoleGuard}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('Firewall Rule Arguments')).toBeVisible();
		await fillRuleForm(page, {sourceIP: '10.0.0.0/33', destinationIP: '198.51.100.9/32', preference: '209'}, {drop: true});

		const addBtn = dialogButton(page, 'Add');
		if (await isEventuallyDisabled(addBtn)) {
			await dialogButton(page, 'Cancel').click();
			return; // form blocked the submit — strongest pass
		}

		// Form let it through: the gateway must 4xx and the UI must surface
		// an error popup instead of crashing (or creating the rule).
		consoleGuard.allow(/Failed to load resource/);
		let created = false;
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(FW_PATH)).catch(() => null),
			addBtn.click(),
		]);
		if (req) {
			const resp = await req.response();
			created = (resp?.status() ?? 500) < 300;
		}
		if (created) {
			// Never leak a non-documentation-IP rule, even on failure.
			await gw('DELETE', `${FW_PATH}?${firewallDeleteQuery({sourceIP: '10.0.0.0/33', destinationIP: '198.51.100.9/32', protocol: 1, preference: 209})}`);
		}
		expect(created, 'invalid /33 CIDR must be rejected by form or gateway').toBe(false);
		await expect(dialogTitle(page, 'Error')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});

	test('V-ports: source min > max must not create a rule', async ({page, consoleGuard}) => {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('Firewall Rule Arguments')).toBeVisible();
		await fillRuleForm(
			page,
			{sourceIP: '203.0.113.10/32', destinationIP: '198.51.100.10/32', srcPortMin: '2000', srcPortMax: '1000', protocolOption: 'TCP(6)', preference: '210'},
			{drop: true},
		);

		const addBtn = dialogButton(page, 'Add');
		if (await isEventuallyDisabled(addBtn)) {
			await dialogButton(page, 'Cancel').click();
			return;
		}

		consoleGuard.allow(/Failed to load resource/);
		let created = false;
		const [req] = await Promise.all([
			page.waitForRequest(r => r.method() === 'POST' && r.url().includes(FW_PATH)).catch(() => null),
			addBtn.click(),
		]);
		if (req) {
			const resp = await req.response();
			created = (resp?.status() ?? 500) < 300;
		}
		if (created) {
			await gw('DELETE', `${FW_PATH}?${firewallDeleteQuery({sourceIP: '203.0.113.10/32', destinationIP: '198.51.100.10/32', minSourcePort: 2000, maxSourcePort: 1000, protocol: 6, preference: 210})}`);
		}
		expect(created, 'min>max port range must be rejected by form or gateway').toBe(false);
		await expect(dialogTitle(page, 'Error')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});

	test('D-multi (F16 regression): bulk delete fires one DELETE per selected row', async ({page}) => {
		await apiCreate(seedRule({sourceIP: '203.0.113.21/32', destinationIP: '198.51.100.21/32', preference: 221}));
		await apiCreate(seedRule({sourceIP: '203.0.113.22/32', destinationIP: '198.51.100.22/32', preference: 222}));
		await apiCreate(seedRule({sourceIP: '203.0.113.23/32', destinationIP: '198.51.100.23/32', preference: 223}));

		await refreshUntilRow(page, '203.0.113.21');
		await refreshUntilRow(page, '203.0.113.22');
		await refreshUntilRow(page, '203.0.113.23');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.21');
			await selectRowByText(page, '203.0.113.22');
			await selectRowByText(page, '203.0.113.23');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 3 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});

		expect(deletes, 'one DELETE per selected row (F16)').toHaveLength(3);
		const sources = deletes.map(u => u.searchParams.get('sourceIP')).sort();
		expect(sources[0]).toContain('203.0.113.21');
		expect(sources[1]).toContain('203.0.113.22');
		expect(sources[2]).toContain('203.0.113.23');

		await refreshUntilGone(page, /203\.0\.113\.2[123]/);
	});

	test('D-partial: deleting 2 of 3 leaves the third intact', async ({page}) => {
		await apiCreate(seedRule({sourceIP: '203.0.113.31/32', destinationIP: '198.51.100.31/32', preference: 231}));
		await apiCreate(seedRule({sourceIP: '203.0.113.32/32', destinationIP: '198.51.100.32/32', preference: 232}));
		await apiCreate(seedRule({sourceIP: '203.0.113.33/32', destinationIP: '198.51.100.33/32', preference: 233}));

		await refreshUntilRow(page, '203.0.113.31');
		await refreshUntilRow(page, '203.0.113.33');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByText(page, '203.0.113.31');
			await selectRowByText(page, '203.0.113.32');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 2 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(2);

		await refreshUntilGone(page, '203.0.113.31');
		await expect(rowByText(page, '203.0.113.33')).toHaveCount(1);
	});
});
