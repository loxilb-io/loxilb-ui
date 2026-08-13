//---------------------------------------------------------
// Instance Snapshots page — codified regression spec
// (docs/SNAPSHOT_UI_DESIGN.md §9.3, baseline cases 1–8).
//
// Runs against the live testbed (local dev server → testbed OAM → live
// gateway) like every other suite. Mutating cases seed and sweep their own
// e2e- entities; the zz-cleanup leak detector must stay green afterwards.
//
// The honesty invariants under test:
//   • the page never reports success the server didn't return;
//   • a tampered document is caught at dry-run (gateway checksum) with
//     Commit disabled — OAM's upload deliberately checks only the envelope;
//   • typed-confirm gates both restore-commit and delete;
//   • viewer sees no mutating controls but the list still loads.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {
	activeInstance,
	deleteSnapshotById,
	disableSnapshotSchedule,
	downloadSnapshot,
	gw,
	gwJson,
	listSnapshots,
	sweepLbRules,
	sweepSnapshots,
} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle} from '../../helpers/dialogs';
import {grid, refreshUntilGone, refreshUntilRow} from '../../helpers/table';

let instName: string;

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
	// Leftovers from a FAILED prior run (e.g. an orphaned pinned pre-upgrade
	// row) would collide with this run's exact-name assertions — sweep first.
	await sweepSnapshots();
});

test.afterAll(async () => {
	await sweepSnapshots();
	await sweepLbRules();
	await disableSnapshotSchedule();
});

const PAGE = () => `instance/maintenance/snapshots?name=${instName}`;

async function openPage(page: any) {
	await page.goto(PAGE());
	await expect(page.getByRole('button', {name: 'Take Snapshot'})).toBeVisible();
}

/** Row matched by the EXACT name cell — substring matching (rowByText) is a
 * trap here: pre_restore rows carry the source snapshot's name in their
 * description, so `hasText` collides across rows. */
function snapRow(page: any, name: string) {
	return grid(page)
		.locator('.MuiDataGrid-row')
		.filter({has: page.locator(`[data-field="name"] :text-is("${name}")`)});
}

async function selectSnapRow(page: any, name: string) {
	const row = snapRow(page, name);
	await expect(row).toHaveCount(1);
	await row.getByRole('checkbox').check();
}

/** Fills the single-input typed-confirm popup and returns its action button. */
function popupInput(page: any) {
	return dialog(page).locator('input').first();
}

async function takeSnapshotViaUI(page: any, name: string) {
	await page.getByRole('button', {name: 'Take Snapshot'}).click();
	await dialog(page).getByLabel(/Name/).fill(name);
	await dialog(page).getByRole('button', {name: 'Take Snapshot'}).click();
	await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 20_000});
	await dialogButton(page, 'OK').click();
	await expect(dialog(page)).toBeHidden();
}

test.describe('@gw Snapshots page (admin)', () => {
	test('1. take → row with chips/metadata → download matches X-Snapshot-Checksum', async ({page, consoleGuard}) => {
		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-take');

		const row = snapRow(page, 'e2e-spec-take');
		await expect(row).toBeVisible();
		await expect(row.getByText('Manual', {exact: true})).toBeVisible(); // trigger chip carries text, not just color
		await expect(row.getByText(/\d+(\.\d+)? KB/)).toBeVisible();

		// Download through the UI and compare with the server's checksum header.
		await selectSnapRow(page, 'e2e-spec-take');
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', {name: 'Download', exact: true}).click();
		const download = await downloadPromise;
		const path = await download.path();
		const doc = JSON.parse(require('fs').readFileSync(path!, 'utf-8'));

		const snap = (await listSnapshots()).find(s => s.name === 'e2e-spec-take');
		expect(snap).toBeTruthy();
		const apiResp = await downloadSnapshot(snap!.id);
		expect(apiResp.ok).toBeTruthy();
		expect(doc.checksum).toBe(apiResp.headers.get('X-Snapshot-Checksum'));
		expect(doc.schema_version).toBe('1.0');
	});

	test('2. full restore wizard happy path → pre_restore row appears, config restored', async ({page}) => {
		test.slow();
		// Seed an LB, snapshot it, delete it — the restore must resurrect it.
		const lb = {
			serviceArguments: {externalIP: '198.51.100.21', port: 8080, protocol: 'tcp', name: 'e2e-snap-restore-lb'},
			endpoints: [{endpointIP: '198.51.100.13', targetPort: 8080, weight: 1}],
		};
		expect((await gw('POST', '/config/loadbalancer', lb)).ok).toBeTruthy();

		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-restore');
		expect((await gw('DELETE', '/config/loadbalancer/name/e2e-snap-restore-lb')).ok).toBeTruthy();

		await selectSnapRow(page, 'e2e-spec-restore');
		await page.getByRole('button', {name: 'Restore…'}).click();

		// Step 1: dry-run auto-runs; the plan must include the LB to apply.
		const wizard = page.getByRole('dialog', {name: /Restore Snapshot/});
		await expect(wizard.getByText('Dry-run passed — the snapshot is applicable')).toBeVisible({timeout: 20_000});
		await expect(wizard.getByRole('cell', {name: 'loadbalancer'})).toBeVisible();
		await wizard.getByRole('button', {name: 'Continue to Restore'}).click();

		// Step 2: typed confirm — wrong text keeps Restore Now disabled.
		const restoreNow = wizard.getByRole('button', {name: 'Restore Now'});
		await expect(restoreNow).toBeDisabled();
		await wizard.locator('input').fill('not-the-instance');
		await expect(restoreNow).toBeDisabled();
		await wizard.locator('input').fill(instName);
		await expect(restoreNow).toBeEnabled();
		await restoreNow.click();

		// Result rendered from the commit response, verbatim.
		await expect(wizard.getByText('Restore succeeded')).toBeVisible({timeout: 60_000});
		await wizard.getByRole('button', {name: 'Close'}).click();

		// A pre_restore safety row appeared, and the LB is really back.
		await refreshUntilRow(page, /pre-restore-/);
		const lbs = await gwJson<any>('/config/loadbalancer/all');
		expect((lbs.lbAttr ?? []).some((r: any) => r.serviceArguments?.name === 'e2e-snap-restore-lb')).toBeTruthy();
		expect((await gw('DELETE', '/config/loadbalancer/name/e2e-snap-restore-lb')).ok).toBeTruthy();
	});

	test('3. break it: OAM unreachable mid-wizard → error surfaced, no fake success, state consistent after reload', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/net::ERR_FAILED|ERR_INTERNET_DISCONNECTED/i);

		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-outage');
		await selectSnapRow(page, 'e2e-spec-outage');

		// Let the dry-run succeed, then cut OAM off for the commit leg only.
		await page.getByRole('button', {name: 'Restore…'}).click();
		const wizard = page.getByRole('dialog', {name: /Restore Snapshot/});
		await expect(wizard.getByText('Dry-run passed — the snapshot is applicable')).toBeVisible({timeout: 20_000});
		await page.route(/\/oam\/snapshots\/.*\/restore/, route => route.abort('connectionfailed'));
		await wizard.getByRole('button', {name: 'Continue to Restore'}).click();
		await wizard.locator('input').fill(instName);
		await wizard.getByRole('button', {name: 'Restore Now'}).click();

		// The wizard must land on an honest failure — never "Restore succeeded".
		await expect(wizard.getByText('Restore failed before reaching the gateway')).toBeVisible({timeout: 30_000});
		await expect(wizard.getByText('Restore succeeded')).toHaveCount(0);
		await wizard.getByRole('button', {name: 'Close'}).click();
		await page.unroute(/\/oam\/snapshots\/.*\/restore/);

		// Reload → list state consistent (row still there, no phantom pre_restore
		// from the aborted commit — it never reached OAM).
		await page.reload();
		await expect(snapRow(page, 'e2e-spec-outage')).toBeVisible();
	});

	test('4. tampered upload: accepted (envelope-only check) but dry-run blocks commit with the checksum error verbatim', async ({page}) => {
		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-tamper-src');

		// Download a real document, flip one byte of content, re-upload.
		await selectSnapRow(page, 'e2e-spec-tamper-src');
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', {name: 'Download', exact: true}).click();
		const download = await downloadPromise;
		const fs = require('fs');
		const raw = fs.readFileSync(await download.path(), 'utf-8');
		const tampered = raw.includes('"trigger": "manual"')
			? raw.replace('"trigger": "manual"', '"trigger": "tamper"')
			: raw.replace('"trigger":"manual"', '"trigger":"tamper"');
		expect(tampered).not.toBe(raw);
		const tmp = require('path').join(require('os').tmpdir(), 'e2e-tampered-snapshot.json');
		fs.writeFileSync(tmp, tampered);

		await page.getByRole('button', {name: 'Upload', exact: true}).click();
		const chooserPromise = page.waitForEvent('filechooser');
		await dialog(page).getByRole('button', {name: 'Choose File'}).click();
		await (await chooserPromise).setFiles(tmp);
		await dialog(page).getByLabel(/Name/).first().fill('e2e-spec-tampered');
		await dialog(page).getByRole('button', {name: 'Upload', exact: true}).click();
		await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 20_000});
		await dialogButton(page, 'OK').click();

		// The protection lives at restore time: dry-run must refuse.
		await selectSnapRow(page, 'e2e-spec-tampered');
		await page.getByRole('button', {name: 'Restore…'}).click();
		const wizard = page.getByRole('dialog', {name: /Restore Snapshot/});
		await expect(wizard.getByText('This snapshot cannot be restored')).toBeVisible({timeout: 20_000});
		await expect(wizard.getByText(/checksum mismatch/)).toBeVisible();
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toBeDisabled();
		await wizard.getByRole('button', {name: 'Cancel'}).click();
	});

	test('5. delete: pinned blocked until unpin; typed-confirm mismatch keeps Delete disabled', async ({page}) => {
		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-delete');

		// Pin, then attempt delete — blocked with the unpin instruction.
		await selectSnapRow(page, 'e2e-spec-delete');
		await page.getByRole('button', {name: 'Pin', exact: true}).click();
		await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 15_000});
		await dialogButton(page, 'OK').click();
		await selectSnapRow(page, 'e2e-spec-delete');
		await page.getByRole('button', {name: 'Delete', exact: true}).click();
		await expect(dialogTitle(page, 'Pinned snapshot')).toBeVisible();
		await dialogButton(page, 'OK').click();

		// Unpin, then the typed-confirm gate.
		await selectSnapRow(page, 'e2e-spec-delete');
		await page.getByRole('button', {name: 'Unpin'}).click();
		await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 15_000});
		await dialogButton(page, 'OK').click();
		await selectSnapRow(page, 'e2e-spec-delete');
		await page.getByRole('button', {name: 'Delete', exact: true}).click();
		await expect(dialogTitle(page, 'WARNING!! Delete Snapshot')).toBeVisible();
		const deleteBtn = dialogButton(page, 'Delete');
		await expect(deleteBtn).toBeDisabled();
		await popupInput(page).fill('wrong-name');
		await expect(deleteBtn).toBeDisabled();
		await popupInput(page).fill('e2e-spec-delete');
		await expect(deleteBtn).toBeEnabled();
		await deleteBtn.click();
		await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 15_000});
		await dialogButton(page, 'OK').click();
		await refreshUntilGone(page, 'e2e-spec-delete');
	});

	test('9. stale row (deleted by another session): action surfaces the verbatim 404 inline — never the global /404 page', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-stale');
		await selectSnapRow(page, 'e2e-spec-stale');

		// "Another session" deletes the row out from under the UI.
		const snap = (await listSnapshots()).find(s => s.name === 'e2e-spec-stale');
		expect(snap).toBeTruthy();
		expect(await deleteSnapshotById(snap!.id)).toBeTruthy();

		// Acting on the stale selection must surface the server's 404 verbatim
		// in the error popup, with the user still ON the snapshots page.
		await page.getByRole('button', {name: 'Pin', exact: true}).click();
		await expect(dialogTitle(page, 'Error')).toBeVisible({timeout: 15_000});
		await expect(dialog(page).getByText(/not found/i)).toBeVisible();
		await dialogButton(page, 'OK').click();
		expect(page.url()).toContain('/maintenance/snapshots');

		// Same for the wizard: dry-run on the stale row fails inline.
		await selectSnapRow(page, 'e2e-spec-stale'); // still rendered until refetch
		await page.getByRole('button', {name: 'Restore…'}).click();
		const wizard = page.getByRole('dialog', {name: /Restore Snapshot/});
		await expect(wizard.getByText('Dry-run failed')).toBeVisible({timeout: 15_000});
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toBeDisabled();
		await wizard.getByRole('button', {name: 'Cancel'}).click();
		expect(page.url()).toContain('/maintenance/snapshots');
	});

	test('10. Restore Now double-click fires exactly ONE commit request', async ({page}) => {
		test.slow();
		await openPage(page);
		await takeSnapshotViaUI(page, 'e2e-spec-dblclick');
		await selectSnapRow(page, 'e2e-spec-dblclick');
		await page.getByRole('button', {name: 'Restore…'}).click();
		const wizard = page.getByRole('dialog', {name: /Restore Snapshot/});
		await expect(wizard.getByText('Dry-run passed — the snapshot is applicable')).toBeVisible({timeout: 20_000});
		await wizard.getByRole('button', {name: 'Continue to Restore'}).click();
		await wizard.locator('input').fill(instName);

		const commits: string[] = [];
		page.on('request', r => {
			if (r.method() === 'POST' && /\/oam\/snapshots\/.*\/restore/.test(r.url())) commits.push(r.url());
		});
		await wizard.getByRole('button', {name: 'Restore Now'}).dblclick();
		await expect(wizard.getByText(/Restore succeeded|Restore failed|did not complete/)).toBeVisible({timeout: 60_000});
		expect(commits, 'double-click must not double-commit').toHaveLength(1);
		await wizard.getByRole('button', {name: 'Close'}).click();
	});

	test('7. legacy config-management page stays dead', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		await page.goto('config-management');
		await expect(page.getByText(/404|not found/i).first()).toBeVisible();
	});

	test('8. Pre-Upgrade button: one click yields a pinned pre_upgrade row with the version-stamped name', async ({page}) => {
		await openPage(page);
		await page.getByRole('button', {name: 'Pre-Upgrade Snapshot'}).click();
		await dialogButton(page, 'Take & Pin').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 20_000});
		await dialogButton(page, 'OK').click();

		// Name is stamped with the REAL gateway version from the take response.
		const version = (await gwJson<any>('/version')).version;
		const row = snapRow(page, `pre-upgrade-${version}`);
		await expect(row).toBeVisible();
		await expect(row.getByText('Pre-Upgrade', {exact: true})).toBeVisible();
		await expect(row.getByText('Pinned', {exact: true})).toBeVisible();

		// Cleanup needs force (it's pinned) — handled by the afterAll sweep;
		// mark it e2e so the sweep finds it.
		const snap = (await listSnapshots()).find(s => s.name === `pre-upgrade-${version}`);
		if (snap) await deleteSnapshotById(snap.id, true);
	});
});

test.describe('@gw Snapshots page (viewer)', () => {
	test.use({storageState: '.auth/viewer.json'});

	test('6. viewer: list loads, zero mutating controls, no mutation requests', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		const mutations: string[] = [];
		page.on('request', r => {
			if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.method()) && !/\/(login|logout)\b/.test(r.url())) {
				mutations.push(`${r.method()} ${r.url()}`);
			}
		});
		await page.goto(PAGE());
		await page.waitForLoadState('domcontentloaded');
		await page.waitForTimeout(2000);

		// The read surface renders…
		await expect(page.getByRole('grid')).toBeVisible();
		// …but no mutating control exists for a viewer.
		for (const name of ['Take Snapshot', 'Pre-Upgrade Snapshot', 'Upload', 'Schedule', 'Restore…', 'Download', 'Pin', 'Delete']) {
			await expect(page.getByRole('button', {name, exact: true})).toHaveCount(0);
		}
		expect(mutations, 'viewer triggered mutation requests').toEqual([]);
	});
});
