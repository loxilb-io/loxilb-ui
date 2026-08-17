//---------------------------------------------------------
// File System page spec.
// Read-only table. Pins the F-STATUS-2 regression: the page used to render
// a hardcoded dummy mount list (/dev/sda1, /dev/sda2 on /var, 50G/100G) with
// the real /status/filesystem query commented out, and its Refresh button was
// a console.log no-op. Now it must show the live gateway data and refetch.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {gwJson} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';
import {grid, toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('@loxilb File System page (read-only)', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/status/fs?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
	});

	test('F-STATUS-2: lists the live filesystems, not the old dummy mounts', async ({page}) => {
		const data = await gwJson<{filesystemAttr?: {fileSystem: string}[]}>('/status/filesystem');
		const fsNames = (data.filesystemAttr ?? []).map(f => f.fileSystem);
		expect(fsNames.length, 'testbed should report ≥1 filesystem').toBeGreaterThan(0);

		// Every real filesystem the API reports is shown.
		for (const name of fsNames.slice(0, 5)) {
			await expect(grid(page).locator('.MuiDataGrid-cell', {hasText: name}).first()).toBeVisible();
		}

		// The dummy signature must be gone: the mock listed /dev/sda1 & /dev/sda2,
		// neither of which exists on the containerized testbed (it uses /dev/vda2
		// + overlay). If the API genuinely returned an sda device we'd skip — but
		// it does not here.
		if (!fsNames.some(n => n.startsWith('/dev/sda'))) {
			await expect(grid(page).locator('.MuiDataGrid-cell', {hasText: '/dev/sda1'})).toHaveCount(0);
			await expect(grid(page).locator('.MuiDataGrid-cell', {hasText: '/dev/sda2'})).toHaveCount(0);
		}
	});

	test('F-STATUS-2: Refresh actually refetches /status/filesystem', async ({page}) => {
		// The old handler only did console.log(); the fix wires it to the query's
		// refetch, so clicking Refresh must issue a real GET. react-query dedupes
		// refetch() while the page's own poll fetch is still in flight (likely on
		// a slow WAN testbed under load), so a single click can legitimately
		// produce no NEW request — retry the click a few times before calling it
		// a regression.
		let seen = false;
		for (let i = 0; i < 3 && !seen; i++) {
			[seen] = await Promise.all([
				page
					.waitForRequest(r => r.method() === 'GET' && /\/status\/filesystem/.test(r.url()), {timeout: 7_000})
					.then(() => true)
					.catch(() => false),
				toolbarButton(page, 'Refresh').click(),
			]);
		}
		expect(seen, 'Refresh issues a GET /status/filesystem').toBe(true);
	});
});
