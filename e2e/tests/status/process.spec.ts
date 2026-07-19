//---------------------------------------------------------
// Process page spec (docs/E2E_CRUD_TEST_PLAN.md §6).
// Read-only table + per-process detail panel. Pins the F-STATUS-4 regression:
// selecting ANY row used to crash the page with "Too many re-renders" (a
// useMemo that called setState during render, re-triggered every render because
// process_info was a fresh object). The consoleGuard fixture fails the test on
// the uncaught React error, so simply selecting a row and asserting the detail
// panel renders is the regression guard.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance, gwJson} from '../../helpers/api';
import {grid, rowByText, toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('Process page (read-only)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/status/process?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
	});

	test('lists the loxilb process from /status/process', async ({page}) => {
		const data = await gwJson<{processAttr?: {command: string}[]}>('/status/process');
		expect((data.processAttr ?? []).some(p => p.command === 'loxilb'), 'gateway must report a loxilb process').toBe(true);
		await expect(rowByText(page, 'loxilb').first()).toBeVisible();
	});

	test('F-STATUS-4: selecting a process row shows the detail panel without crashing', async ({page}) => {
		const loxilbRow = grid(page).locator('.MuiDataGrid-row').filter({has: page.locator('.MuiDataGrid-cell', {hasText: /^loxilb$/})});
		await expect(loxilbRow).toHaveCount(1);
		await loxilbRow.getByRole('checkbox').check();

		// Detail panel groups render (the page did not fall into the error
		// boundary). consoleGuard (auto) fails the test if the render loop returns.
		await expect(page.getByText('Resource Usage')).toBeVisible();
		await expect(page.getByText('CPU Usage')).toBeVisible();
		await expect(page.getByText('Memory Status')).toBeVisible();

		// Toggling selection off/on must stay stable too.
		await loxilbRow.getByRole('checkbox').uncheck();
		await expect(page.getByText('Resource Usage')).toHaveCount(0);
		await loxilbRow.getByRole('checkbox').check();
		await expect(page.getByText('Resource Usage')).toBeVisible();
	});
});
