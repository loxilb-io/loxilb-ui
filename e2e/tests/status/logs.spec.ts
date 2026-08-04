//---------------------------------------------------------
// Logs page spec (docs/E2E_CRUD_TEST_PLAN.md §6).
// Read-only: live log stream + client-side level filter + server-side keyword
// filter + downloadable archives. Level filtering is client-side over the
// currently-loaded page by design (the connector never sends `level` to the
// API), so selecting a level narrows/relabels but may show 0 until more pages
// load — asserted here as behaviour, not a bug. D-archive is not implementable
// (the archive card has no delete affordance) and is documented, not tested.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson} from '../../helpers/api';

let instName: string;

test.describe('Logs page (read-only)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/status/logs?name=${instName}`); // relative — see baseURL note
		await expect(page.getByRole('heading', {name: 'Instance Logs'})).toBeVisible({timeout: 20_000});
	});

	test('streams live log lines and lists the archives from /log-archives', async ({page}) => {
		// Live lines loaded (chip reports a non-zero count once the initial page
		// arrives).
		await expect(page.locator('.MuiChip-label', {hasText: /logs loaded/})).toBeVisible();
		await expect(page.locator('.MuiDataGrid-row').first()).toBeVisible();

		const {archives} = await gwJson<{archives: string[]}>('/log-archives');
		expect(archives.length, 'testbed should expose ≥1 log archive').toBeGreaterThan(0);
		// The archives card pages 5 rows at a time (SimpleTable pageSize=5), so
		// walk the pages and collect what renders instead of expecting every
		// archive on the first page (broke at >5 archives on the testbed).
		// Everything is scoped to the card — the live-logs grid below has its
		// own pager and its rows can embed archive names in log messages.
		const card = page.locator('.MuiPaper-root').filter({hasText: 'Archived Logs'}).first();
		const nextBtn = card.getByRole('button', {name: /go to next page/i});
		const seen = new Set<string>();
		for (;;) {
			for (const name of archives) {
				if (seen.has(name)) continue;
				if (await card.getByText(name, {exact: true}).isVisible().catch(() => false)) seen.add(name);
			}
			if (seen.size === archives.length) break;
			if (!(await nextBtn.isEnabled().catch(() => false))) break;
			await nextBtn.click();
			await page.waitForTimeout(200); // let the grid swap pages
		}
		expect([...seen].sort(), 'every /log-archives entry is listed in the card').toEqual([...archives].sort());
	});

	test('level filter relabels via a chip and keyword filter hits the /logs API', async ({page}) => {
		// Level filter (client-side) — the first combobox on the page is Level.
		await page.getByRole('combobox').first().click();
		await page.getByRole('option', {name: 'ERROR'}).click();
		await expect(page.locator('.MuiChip-label', {hasText: 'Level: ERROR'})).toBeVisible();

		// Keyword filter is server-side: applying it must issue a /logs request
		// carrying the keyword param.
		await page.getByRole('textbox', {name: 'Search Keyword'}).fill('metrics');
		const [req] = await Promise.all([
			page.waitForRequest(r => /\/logs\?/.test(r.url()) && /keyword=metrics/.test(r.url()), {timeout: 10_000}),
			page.getByRole('button', {name: 'Apply Keyword Filters'}).click(),
		]);
		expect(req.url()).toContain('keyword=metrics');
		await expect(page.locator('.MuiChip-label', {hasText: 'Keyword: metrics'})).toBeVisible();
	});

	test('archives are downloadable (endpoint returns a non-empty body)', async ({page}) => {
		const {archives} = await gwJson<{archives: string[]}>('/log-archives');
		test.skip(archives.length === 0, 'no archives on the testbed');
		const resp = await gw('GET', `/log-archives/${encodeURIComponent(archives[0])}`);
		expect(resp.ok, `download of ${archives[0]} should succeed`).toBe(true);
		const body = await resp.arrayBuffer();
		expect(body.byteLength, 'downloaded archive must be non-empty').toBeGreaterThan(0);

		// D-archive: the archive card offers download only — there is deliberately
		// no delete affordance, so the plan's delete-one-archive case is n/a.
		await expect(page.locator('[data-testid="DeleteIcon"]')).toHaveCount(0);
	});
});
