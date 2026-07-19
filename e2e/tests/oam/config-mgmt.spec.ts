//---------------------------------------------------------
// Config management spec (docs/E2E_CRUD_TEST_PLAN.md §7, admin-only).
//   • Export with an `e2e-` description → the file is listed
//   • Download → a non-empty JSON body (parses, carries metadata)
//   • Import DRY-RUN ONLY → the preview renders, /config/import/dry-run
//     fires and the real /config/import (apply) NEVER does
//   • D-file → delete the export
//
// Exports are marked `e2e-` so afterAll (and zz-cleanup) can sweep them.
//---------------------------------------------------------
import fs from 'fs';
import path from 'path';
import {expect, test} from '../../fixtures';
import {downloadConfigFile, exportConfig, sweepConfigExports} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, expectSuccessAndDismiss} from '../../helpers/dialogs';

const SCRATCH = path.resolve(__dirname, '../../../test-results');

let seq = 0;
function uniqDesc(): string {
	return `e2e-cfg-${Date.now().toString().slice(-7)}-${seq++}`;
}

function fileCard(page: import('@playwright/test').Page, desc: string) {
	return page.locator('.MuiPaper-root').filter({hasText: desc});
}

test.describe.serial('Config management (admin)', () => {
	test.afterAll(async () => {
		await sweepConfigExports();
	});

	test('Export: create with e2e- description → listed in File Management', async ({page}) => {
		const desc = uniqDesc();
		const posts: string[] = [];
		const cap = (r: any) => {
			if (r.method() === 'POST' && /\/config\/export$/.test(r.url())) posts.push(r.url());
		};
		page.on('request', cap);
		try {
			await page.goto('config-management');
			await expect(page.getByRole('tab', {name: 'Export'})).toBeVisible({timeout: 20_000});
			await page.getByLabel('Description (Optional)').fill(desc);
			await page.getByRole('button', {name: 'Start Export'}).click();
			await expectSuccessAndDismiss(page);
		} finally {
			page.off('request', cap);
		}
		expect(posts.length, 'POST /config/export fired').toBeGreaterThan(0);

		await page.getByRole('tab', {name: 'File Management'}).click();
		await page.getByRole('button', {name: 'Refresh'}).click();
		const card = fileCard(page, desc);
		await expect(card).toBeVisible({timeout: 20_000});
		// The card carries real metadata (status chip + human size/expiry line),
		// not just a bare filename.
		await expect(card.getByText('Available')).toBeVisible();
		await expect(card).toContainText(/expires in/i);
	});

	test('Download: the exported file is a non-empty JSON document', async ({page}) => {
		const desc = uniqDesc();
		await exportConfig(desc); // seed via API; the download UI is what we test

		await page.goto('config-management');
		await page.getByRole('tab', {name: 'File Management'}).click();
		await page.getByRole('button', {name: 'Refresh'}).click();
		const card = fileCard(page, desc);
		await expect(card).toBeVisible({timeout: 20_000});

		const [download] = await Promise.all([page.waitForEvent('download'), card.getByRole('button', {name: 'Download'}).click()]);
		const dest = path.join(SCRATCH, `dl-${desc}.json`);
		await download.saveAs(dest);
		const body = fs.readFileSync(dest, 'utf-8');
		expect(body.length, 'downloaded file is non-empty').toBeGreaterThan(0);
		const parsed = JSON.parse(body);
		expect(parsed.metadata ?? parsed, 'downloaded file is JSON').toBeTruthy();
		await expectSuccessAndDismiss(page); // the "downloaded successfully" popup
	});

	test('Download failure: a missing/removed file surfaces a clear error, not a crash', async ({page, consoleGuard}) => {
		// The backing file can vanish (ephemeral server storage, expiry). The
		// fetch 404s and logs to console by design — allow it; what we assert is
		// that the UI degrades to an honest dialog and refreshes, never crashes.
		consoleGuard.allow(/Download failed: 404/);
		consoleGuard.allow(/Failed to load resource.*404/);

		const desc = uniqDesc();
		await exportConfig(desc);

		await page.goto('config-management');
		await page.getByRole('tab', {name: 'File Management'}).click();
		await page.getByRole('button', {name: 'Refresh'}).click();
		const card = fileCard(page, desc);
		await expect(card).toBeVisible({timeout: 20_000});

		// Force the backing-file fetch to fail deterministically, independent of
		// testbed disk state (mirrors the real "Export file not found" 404).
		await page.route('**/config/download/**', route =>
			route.fulfill({status: 404, contentType: 'application/json', body: '{"error":"Export file not found"}'}),
		);
		try {
			await card.getByRole('button', {name: 'Download'}).click();
			await expect(dialogTitle(page, 'Download Error')).toBeVisible({timeout: 20_000});
			await expect(dialog(page)).toContainText(/could not be downloaded/i);
			await dialogButton(page, 'OK').click();
		} finally {
			await page.unroute('**/config/download/**');
		}
	});

	test('Expired export: download is disabled and the file is flagged Expired', async ({page}) => {
		// No API to expire a file on demand, so inject one expired record into the
		// list response and assert the UI gates the download on is_expired.
		await page.route('**/config/files*', route =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					files: [
						{
							id: 'e2e-expired-fixture',
							filename: 'config-e2e-expired.json',
							description: 'e2e-expired-fixture',
							exported_at: '2026-01-01T00:00:00Z',
							exported_by: 'admin',
							file_size: 100,
							file_size_human: '100 B',
							file_exists: false,
							is_expired: true,
							expires_in: '0 minutes',
							download_count: 0,
						},
					],
					pagination: {},
					filters: {},
					message: 'ok',
				}),
			}),
		);
		try {
			await page.goto('config-management');
			await page.getByRole('tab', {name: 'File Management'}).click();
			const card = fileCard(page, 'e2e-expired-fixture');
			await expect(card).toBeVisible({timeout: 20_000});
			// Target the status chip exactly (the filename/description also contain "expired").
			await expect(card.getByText('Expired', {exact: true})).toBeVisible();
			await expect(card.getByRole('button', {name: 'Download'})).toBeDisabled();
		} finally {
			await page.unroute('**/config/files*');
		}
	});

	test('Import: dry-run only renders a preview and never applies', async ({page}) => {
		// A real self-export is a guaranteed-valid dry-run input.
		const id = await exportConfig(uniqDesc());
		const body = await downloadConfigFile(id);
		const uploadPath = path.join(SCRATCH, `import-${id}.json`);
		fs.mkdirSync(SCRATCH, {recursive: true});
		fs.writeFileSync(uploadPath, body);

		const dryRuns: string[] = [];
		const applies: string[] = [];
		const cap = (r: any) => {
			const u = r.url();
			if (r.method() !== 'POST') return;
			if (/\/config\/import\/dry-run$/.test(u)) dryRuns.push(u);
			else if (/\/config\/import$/.test(u)) applies.push(u);
		};
		page.on('request', cap);
		try {
			await page.goto('config-management');
			await page.getByRole('tab', {name: 'Import'}).click();
			await page.locator('input[type="file"]').setInputFiles(uploadPath);

			// The validation outcome surfaces as the "validated successfully" popup…
			await expect(dialogTitle(page, 'Success')).toBeVisible({timeout: 20_000});
			await dialogButton(page, 'OK').click();
			// …and the in-page preview marks the file importable.
			await expect(page.getByText(/valid and ready for import/i)).toBeVisible();
		} finally {
			page.off('request', cap);
		}
		expect(dryRuns.length, 'dry-run validation fired').toBeGreaterThan(0);
		expect(applies, 'the apply endpoint must NEVER be called by a dry-run').toEqual([]);
	});

	test('D-file: delete an export', async ({page}) => {
		const desc = uniqDesc();
		await exportConfig(desc);

		await page.goto('config-management');
		await page.getByRole('tab', {name: 'File Management'}).click();
		await page.getByRole('button', {name: 'Refresh'}).click();
		const card = fileCard(page, desc);
		await expect(card).toBeVisible({timeout: 20_000});

		await card.getByRole('button', {name: 'Delete'}).click();
		await expect(dialogTitle(page, 'Delete Configuration File')).toBeVisible();
		await dialogButton(page, 'Delete').click();
		await expectSuccessAndDismiss(page);
		await expect(fileCard(page, desc)).toHaveCount(0);
	});
});
