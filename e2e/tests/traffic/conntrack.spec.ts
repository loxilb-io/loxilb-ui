//---------------------------------------------------------
// Conntrack page spec (docs/E2E_CRUD_TEST_PLAN.md §1.4).
//
// Conntrack is READ-ONLY in the UI: ConntrackTable renders the shared
// DataTable with hideCheckbox and only an onRefresh handler — there is no
// add, edit, or delete affordance (the plan's "D-entry delete a flow" is
// not reachable from the UI; loxilb exposes flow deletion only via the
// gateway API, which this page never calls). So this spec asserts the
// read + client-side-filter behaviour and the absence of any mutation
// control, against the live conntrack table (row set varies run to run).
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {grid, showAllRows, toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('Conntrack page (read + filter)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/ct?name=${instName}`); // relative — see baseURL note
		await expect(grid(page)).toBeVisible({timeout: 20_000});
	});

	test('read-only: grid + filters render, no add/edit/delete controls exist', async ({page}) => {
		// Column headers from ConntrackTable.
		for (const header of ['Service Name', 'Source', 'Destination', 'Protocol']) {
			await expect(page.getByRole('columnheader', {name: header})).toBeVisible();
		}

		// Filter controls (page-level, above the grid).
		await expect(page.getByLabel('Source IP')).toBeVisible();
		await expect(page.getByLabel('Destination Port')).toBeVisible();

		// Only Refresh is wired; conntrack has no mutation path.
		await expect(toolbarButton(page, 'Refresh')).toHaveCount(1);
		await expect(toolbarButton(page, 'Add')).toHaveCount(0);
		await expect(toolbarButton(page, 'Delete')).toHaveCount(0);
		await expect(toolbarButton(page, 'Mode')).toHaveCount(0);
	});

	test('filter: a non-matching service name empties the grid; Clear All resets the filter', async ({page}) => {
		await showAllRows(page);

		const rows = grid(page).locator('.MuiDataGrid-row');
		// Measure the live (unfiltered) row set at test time — conntrack flows
		// are volatile, so a beforeAll snapshot would be stale.
		const before = await rows.count();

		// A service name that cannot exist filters every live flow out.
		await page.getByLabel('Service Name').fill('zzz-no-such-flow-12345');
		if (before > 0) {
			// Narrowing is only demonstrable when the table had rows to remove.
			await expect(rows).toHaveCount(0);
		}

		// Clear All resets the filter itself (deterministic — independent of
		// whether volatile flows have since aged out). The chip only shows
		// while a filter is active.
		const clearAll = page.getByRole('button', {name: /Clear All/});
		await expect(clearAll).toBeVisible();
		await clearAll.click();
		await expect(page.getByLabel('Service Name')).toHaveValue('');
		await expect(clearAll).toBeHidden();
	});
});
