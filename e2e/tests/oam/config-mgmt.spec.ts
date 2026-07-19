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
		await expect(fileCard(page, desc)).toBeVisible({timeout: 20_000});
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
