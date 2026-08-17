//---------------------------------------------------------
// Logs page spec.
//
// The page renders the shared LogConsole (also used by the dashboard card):
// one toolbar, a severity strip that doubles as the level filter, and a table.
//
// Scope rules worth knowing before reading the assertions:
//   - keyword goes to the gateway (server-side) and is debounced, so typing
//     must produce exactly ONE request, not one per keystroke;
//   - level and time range are applied client-side over the lines already
//     paged in, so they must narrow the grid WITHOUT any network call. That is
//     deliberate: the endpoint pages by byte offset and `has_more` counts bytes
//     rather than matches, so a server-side level filter would report counts
//     for one page as if they were the whole file;
//   - gzipped archives are selectable — the gateway inflates them before
//     paging. They were disabled back when the endpoint served them raw.
// D-archive is not implementable (the archive card has no delete affordance)
// and is documented, not tested.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {gw, gwJson} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';

let instName: string;

/** Records every /logs request the page issues, for scope assertions. */
function trackLogRequests(page: import('@playwright/test').Page): string[] {
	const urls: string[] = [];
	page.on('request', r => {
		if (/\/logs\?/.test(r.url()) && r.method() === 'GET') urls.push(r.url());
	});
	return urls;
}

/**
 * Waits until the first page of lines has actually landed.
 *
 * The "Filtering N loaded lines" caption is NOT a readiness signal — it renders
 * at N=0 before any response arrives, so gating on it let the initial fetch land
 * *after* a test started counting requests and broke the client-side-only
 * assertions. A severity chip only exists once lines have been counted, and a
 * grid row only once they are rendered.
 */
async function awaitFirstPage(page: import('@playwright/test').Page) {
	await expect(
		page.locator('.MuiChip-root').filter({hasText: /^(CRITICAL|ERROR|WARNING|INFO|DEBUG) \d+$/}).first(),
	).toBeVisible({timeout: 30_000});
	await expect(page.locator('.MuiDataGrid-row').first()).toBeVisible({timeout: 30_000});
}

test.describe('@loxilb Logs page (read-only)', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/status/logs?name=${instName}`); // relative — see baseURL note
		await expect(page.getByRole('heading', {name: 'Instance Logs'})).toBeVisible({timeout: 20_000});
	});

	test('streams live log lines and lists the archives from /log-archives', async ({page}) => {
		await awaitFirstPage(page);

		// The console states the scope it filters over, so a level/time filter is
		// never mistaken for a search of the whole file.
		await expect(page.getByText(/Filtering \d+ loaded lines/)).toBeVisible();

		// Snapshot the archive list FIRST, then reload so the page's own
		// /log-archives fetch is at least as fresh as the snapshot — the gateway
		// rotates loxilbdp-*.log.gz continuously, and comparing an older page
		// render against a newer API snapshot failed on freshly-rotated files.
		const {archives} = await gwJson<{archives: string[]}>('/log-archives');
		expect(archives.length, 'testbed should expose ≥1 log archive').toBeGreaterThan(0);
		await page.reload();
		await expect(page.getByRole('heading', {name: 'Instance Logs'})).toBeVisible({timeout: 20_000});
		// The archives card pages 5 rows at a time (SimpleTable pageSize=5), so
		// walk the pages and read the filename cells directly instead of
		// expecting every archive on the first page (broke at >5 archives on
		// the testbed). Waiting for the rows before reading matters: a plain
		// isVisible() probe raced the post-navigation render and missed rows.
		// Everything is scoped to the card — the live-logs grid below has its
		// own pager and its rows can embed archive names in log messages.
		const card = page.locator('.MuiPaper-root').filter({hasText: 'Archived Logs'}).first();
		const nextBtn = card.getByRole('button', {name: /go to next page/i});
		const seen = new Set<string>();
		for (let pageNo = 0; pageNo < 10; pageNo++) {
			await expect(card.locator('.MuiDataGrid-row').first()).toBeVisible();
			await page.waitForTimeout(150); // let the page's row set settle
			for (const txt of await card.locator('[data-field="filename"]').allTextContents()) {
				if (txt.trim()) seen.add(txt.trim());
			}
			if (!(await nextBtn.isEnabled().catch(() => false))) break;
			await nextBtn.click();
		}
		// The card must list every archive from the pre-reload snapshot; extra
		// entries (files rotated in since) are fine.
		const missing = archives.filter(a => !seen.has(a));
		expect(missing, 'every /log-archives entry is listed in the card').toEqual([]);
	});

	test('severity chip filters client-side and toggles off without a round trip', async ({page}) => {
		await awaitFirstPage(page);

		const chip = page.locator('.MuiChip-root').filter({hasText: /^(INFO|DEBUG) \d+$/}).first();
		const label = (await chip.innerText()).trim();
		const count = Number(label.split(/\s+/)[1]);
		expect(count, 'severity chip should carry a non-zero count').toBeGreaterThan(0);

		const requests = trackLogRequests(page);
		const grid = page.locator('.MuiDataGrid-row');
		const before = await grid.count();

		await chip.click();
		// Narrowing to one level must reduce (or at most equal) the rendered set,
		// and the chip becomes filled to show it is active.
		await expect(chip).toHaveClass(/MuiChip-filled/);
		await expect(page.getByRole('button', {name: 'Reset filters'})).toBeVisible();

		// Clicking the same chip clears the filter again.
		await chip.click();
		await expect(chip).toHaveClass(/MuiChip-outlined/);
		await expect.poll(() => grid.count()).toBe(before);

		expect(requests, 'level filtering is client-side and must not hit the gateway').toEqual([]);
	});

	test('time range preset narrows client-side without a round trip', async ({page}) => {
		await awaitFirstPage(page);

		const requests = trackLogRequests(page);

		await page.getByRole('combobox', {name: 'Time range'}).click();
		await page.getByRole('option', {name: 'Last 5 min'}).click();
		await expect(page.getByRole('button', {name: 'Reset filters'})).toBeVisible();

		// Reset returns every filter to its default in one action.
		await page.getByRole('button', {name: 'Reset filters'}).click();
		await expect(page.getByRole('button', {name: 'Reset filters'})).toBeHidden();

		expect(requests, 'the time range is applied client-side').toEqual([]);
	});

	test('keyword search is debounced into a single server-side request', async ({page}) => {
		await awaitFirstPage(page);

		const requests = trackLogRequests(page);
		const search = page.getByRole('textbox', {name: 'Search'});

		// Type character by character. The old UI required an Apply click; the
		// console debounces instead, so seven keystrokes must collapse to one
		// request carrying only the final keyword.
		await search.pressSequentially('metrics', {delay: 60});
		await expect.poll(() => requests.length, {timeout: 10_000}).toBe(1);
		expect(requests[0]).toContain('keyword=metrics');

		// Give any stray trailing debounce a chance to fire before asserting.
		await page.waitForTimeout(1500);
		expect(requests, 'debounce must not issue one request per keystroke').toHaveLength(1);
	});

	// Guards a bug that shipped once already: the toggle flipped to "pressed"
	// while the polling flag never reached the query, so Live looked enabled and
	// nothing ever refreshed. Asserting the button state alone would not have
	// caught it — only the requests do.
	test('live tail polls the gateway and stops when switched off', async ({page}) => {
		await awaitFirstPage(page);

		const requests = trackLogRequests(page);
		const live = page.getByRole('button', {name: 'Live'});

		await live.click();
		await expect(live).toHaveAttribute('aria-pressed', 'true');
		// One request for the key change, then at least one interval poll.
		await expect.poll(() => requests.length, {timeout: 30_000}).toBeGreaterThanOrEqual(2);

		await live.click();
		await expect(live).toHaveAttribute('aria-pressed', 'false');
		const settled = requests.length;
		await page.waitForTimeout(12_000);
		// Allow a single in-flight response to land after the toggle.
		expect(requests.length, 'polling must stop once live tail is off').toBeLessThanOrEqual(settled + 1);
	});

	test('gzipped archives are selectable and page into the grid', async ({page}) => {
		const {archives} = await gwJson<{archives: string[]}>('/log-archives');
		const gz = archives.filter(a => a.endsWith('.gz'));
		test.skip(gz.length === 0, 'no compressed archives on the testbed');

		await awaitFirstPage(page);
		await page.getByRole('combobox', {name: 'Log file'}).click();

		// The gateway inflates .gz before paging, so these entries load like any
		// other file. They used to be disabled here because the endpoint served
		// the compressed bytes raw and the table came back silently empty —
		// selecting one and getting rows is the whole point of this test.
		const gzOption = page.getByRole('option', {name: new RegExp(`^${gz[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)});
		await expect(gzOption).not.toHaveAttribute('aria-disabled', 'true');
		await gzOption.click();

		// Rows, not just an absence of errors: inflating correctly but failing to
		// parse the inflated lines would also leave the grid empty.
		await expect(page.locator('.MuiDataGrid-row').first()).toBeVisible({timeout: 20_000});
		await expect(page.getByText(/^(CRITICAL|ERROR|WARNING|INFO|DEBUG) \d+$/).first()).toBeVisible();
	});

	// Regression: the strip only rendered a chip for levels with a NON-ZERO
	// count, so the moment the loaded set held none of the selected level its
	// chip disappeared — while the filter stayed on. That left an empty grid,
	// nothing on screen saying why, and no chip left to click to undo it.
	//
	// Driven here with a keyword that matches nothing, because that empties every
	// count deterministically. Switching to a log file that happens to lack the
	// level does the same thing to the same code path, but whether any two files
	// on the testbed differ in severities is luck — a version of this test that
	// went that way passed against the unfixed build.
	test('a selected level keeps its chip when nothing in view has that level', async ({page}) => {
		await awaitFirstPage(page);

		const chip = page.locator('.MuiChip-root').filter({hasText: /^(INFO|DEBUG) \d+$/}).first();
		const level = (await chip.innerText()).trim().split(/\s+/)[0];
		await chip.click();
		await expect(chip).toHaveClass(/MuiChip-filled/);

		// Server-side, whole-file, and guaranteed to match no line.
		const landed = page.waitForResponse(
			r => /\/logs\?/.test(r.url()) && r.url().includes('keyword=') && r.ok(),
			{timeout: 30_000},
		);
		await page.getByRole('textbox', {name: 'Search'}).fill('zzz-no-such-line-zzz');
		await landed;

		await expect(page.getByText('No lines match the current filters')).toBeVisible({timeout: 20_000});

		// The chip survives at a count of zero, so the empty grid has a visible
		// cause instead of being a dead end.
		const persisted = page.locator('.MuiChip-root').filter({hasText: new RegExp(`^${level} 0$`)});
		await expect(persisted).toBeVisible({timeout: 20_000});
		await expect(persisted).toHaveClass(/MuiChip-filled/);

		// And it is still the control that turns the filter off.
		await persisted.click();
		await expect(persisted).toHaveCount(0);

		await page.getByRole('button', {name: 'Reset filters'}).click();
		await expect(page.locator('.MuiDataGrid-row').first()).toBeVisible({timeout: 20_000});
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
