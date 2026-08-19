//---------------------------------------------------------
// Mirror page CRUD spec.
// POST /config/mirror, DELETE /config/mirror/ident/{ident}; payload
// IMirrorAttribute {mirrorIdent, mirrorInfo, targetObject}.
//
// Safety: SPAN is a passive packet copy. The round-trip C-span mirrors to
// the loopback (`lo` when present) so no production port is duplicated;
// RSPAN/ERSPAN only assert the POST payload is field-complete and tolerate
// a gateway rejection (they need VLAN/tunnel plumbing the testbed lacks) —
// the afterEach sweep removes anything that did persist. MirrorTable is a
// hideCheckbox table: single-select by row click, so no D-multi.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, portNames, sweepMirrors} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, expectSuccessAndDismiss, openToolbarDialog, selectOption} from '../../helpers/dialogs';
import {field, isEventuallyDisabled, setField} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByClick, showAllRows, toolbarButton} from '../../helpers/table';

const MIRROR_PATH = '/config/mirror';

let instName: string;
let destPort: string; // mirror destination (loopback when available)
let srcPort: string; // mirrored source port (distinct from destination)

async function openAddDialog(page: Page): Promise<void> {
	await openToolbarDialog(page, 'Add', 'New Mirror');
	await expect(field(page, 'Mirror Identifier')).toBeVisible();
}

/** Attaches the mirror source to a Port (distinct from the SPAN destination). */
async function attachSourcePort(page: Page): Promise<void> {
	await selectOption(page, 'Attachment Type', 'Port');
	await selectOption(page, 'Attached Port', new RegExp(`^${srcPort} \\(`));
}

async function submit(page: Page): Promise<any> {
	await page.mouse.move(0, 0); // dismiss any sticky ParamBox tooltip
	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().includes(MIRROR_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	return req;
}

async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(`${MIRROR_PATH}/ident`)) urls.push(new URL(r.url()));
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return urls;
}

test.describe('Mirror page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		const ports = await portNames();
		expect(ports.length, 'testbed must expose at least one port').toBeGreaterThan(0);
		destPort = ports.includes('lo') ? 'lo' : ports[0];
		srcPort = ports.find(p => p !== destPort) ?? destPort;
		await sweepMirrors();
	});

	test.afterEach(async () => {
		await sweepMirrors();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/mirror?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-span: SPAN default type + port to loopback lands verbatim; D-single round-trip', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Mirror Identifier').fill('e2e-mir-span');
		// Type auto-defaults to SPAN(0); force the destination port to loopback.
		await setField(page, 'Port', destPort);
		await attachSourcePort(page);

		const req = await submit(page);
		const body = req.postDataJSON();

		expect(body.mirrorIdent).toBe('e2e-mir-span');
		// type:0 (SPAN) is the displayed default — must be POSTed, not dropped
		// (stale-snapshot regression in the mirrorInfo subform).
		expect(body.mirrorInfo).toMatchObject({type: 0, port: destPort});
		expect(body.targetObject).toMatchObject({attachment: 1, mirrObjName: srcPort});
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted SPAN create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, 'e2e-mir-span');
		const deletes = await captureDeletes(page, async () => {
			await selectRowByClick(page, 'e2e-mir-span', 'mirrorIdent');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain('/config/mirror/ident/e2e-mir-span');
		await refreshUntilGone(page, 'e2e-mir-span');
	});

	test('V-rspan-vlan: RSPAN with a VLAN blocks submit (the gateway rejects the pair)', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Mirror Identifier').fill('e2e-mir-rspan');
		await selectOption(page, 'Type', 'RSPAN');
		await setField(page, 'Port', destPort);
		await attachSourcePort(page);
		const addBtn = dialogButton(page, 'Add');
		await expect(addBtn, 'RSPAN with no VLAN is submittable').toBeEnabled();

		await field(page, 'VLAN').fill('3999');
		expect(await isEventuallyDisabled(addBtn), 'RSPAN + VLAN must block').toBe(true);
		await expect(dialog(page).getByText(/RSPAN mirror must leave VLAN unset/)).toBeVisible();

		// Clearing the VLAN unblocks.
		await field(page, 'VLAN').fill('');
		await expect(addBtn).toBeEnabled();
		await dialogButton(page, 'Cancel').click();
	});

	test('V-erspan-incomplete: ERSPAN blocks submit until tunnel + source/remote IPs are set', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Mirror Identifier').fill('e2e-mir-erspan-v');
		await selectOption(page, 'Type', 'ERSPAN');
		await setField(page, 'Port', destPort);
		await attachSourcePort(page);
		const addBtn = dialogButton(page, 'Add');

		expect(await isEventuallyDisabled(addBtn), 'ERSPAN with no tunnel/IPs must block').toBe(true);
		await expect(dialog(page).getByText(/ERSPAN mirror requires/)).toBeVisible();

		await field(page, 'Tunnel ID').fill('100');
		await field(page, 'Source IP').fill('203.0.113.1');
		expect(await isEventuallyDisabled(addBtn), 'missing remote IP must still block').toBe(true);

		await field(page, 'Remote IP').fill('203.0.113.2');
		await expect(addBtn).toBeEnabled();
		await dialogButton(page, 'Cancel').click();
	});

	test('C-erspan: ERSPAN with tunnel + source/remote IPs lands verbatim and is accepted', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Mirror Identifier').fill('e2e-mir-erspan');
		await selectOption(page, 'Type', 'ERSPAN');
		await setField(page, 'Port', destPort);
		await field(page, 'Tunnel ID').fill('100');
		await field(page, 'Source IP').fill('203.0.113.1');
		await field(page, 'Remote IP').fill('203.0.113.2');
		await attachSourcePort(page);

		const req = await submit(page);
		const body = req.postDataJSON();
		expect(body.mirrorIdent).toBe('e2e-mir-erspan');
		expect(body.mirrorInfo).toMatchObject({
			type: 2,
			tunnelID: 100,
			sourceIP: '203.0.113.1',
			remoteIP: '203.0.113.2',
		});

		// A field-complete ERSPAN create is accepted by the gateway (verified
		// live) — a rejection here is a regression, not tolerable plumbing noise.
		expect((await req.response())?.status(), 'gateway accepted ERSPAN create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, 'e2e-mir-erspan');
	});
});
