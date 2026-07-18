//---------------------------------------------------------
// Mirror page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §1.6).
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
import {confirmDelete, dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {field, setField} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByClick, showAllRows, toolbarButton} from '../../helpers/table';

const MIRROR_PATH = '/config/mirror';

let instName: string;
let destPort: string; // mirror destination (loopback when available)
let srcPort: string; // mirrored source port (distinct from destination)

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('New Mirror')).toBeVisible();
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
		// (F19-sibling regression in the mirrorInfo subform).
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

	test('C-rspan: RSPAN type + VLAN 3999 land in the POST body', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 4\d\d/);

		await openAddDialog(page);
		await field(page, 'Mirror Identifier').fill('e2e-mir-rspan');
		await selectOption(page, 'Type', 'RSPAN');
		await setField(page, 'Port', destPort);
		await field(page, 'VLAN').fill('3999');
		await attachSourcePort(page);

		const req = await submit(page);
		const body = req.postDataJSON();
		expect(body.mirrorIdent).toBe('e2e-mir-rspan');
		expect(body.mirrorInfo).toMatchObject({type: 1, vlan: 3999});

		// Gateway may reject RSPAN without VLAN plumbing; either way, no crash.
		const status = (await req.response())?.status() ?? 0;
		await expect(dialogTitle(page, status < 300 ? 'Success' : 'Error')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});

	test('C-erspan: ERSPAN type + tunnel + source/remote IPs land in the POST body', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 4\d\d/);

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

		const status = (await req.response())?.status() ?? 0;
		await expect(dialogTitle(page, status < 300 ? 'Success' : 'Error')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});
});
