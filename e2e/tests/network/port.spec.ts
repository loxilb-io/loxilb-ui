//---------------------------------------------------------
// Port page spec.
// Read-only page: no add/edit/delete. Selecting a port row reveals a detail
// TabView (Software / Hardware / Layer 2 / Layer 3). We assert the list
// renders real ports and the per-port detail tabs populate.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {grid, rowByText, revealRow, showAllRows, toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('Port page (read-only)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/port?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('lists ports and shows per-port detail tabs on selection', async ({page}) => {
		// eth0 is always present on the testbed.
		await expect(rowByText(page, 'eth0').first()).toBeVisible();

		// Selecting a port opens the detail TabView. Match the row whose port-name
		// cell is exactly "eth0" — plain hasText also hits rows that merely
		// reference eth0 (e.g. a master column).
		await revealRow(page, 'eth0');
		const ethRow = grid(page).locator('.MuiDataGrid-row').filter({has: page.locator('.MuiDataGrid-cell', {hasText: /^eth0$/})});
		await expect(ethRow).toHaveCount(1);
		await ethRow.getByRole('checkbox').check();
		for (const tab of ['Software', 'Hardware', 'Layer 2', 'Layer 3']) {
			await expect(page.getByRole('tab', {name: tab})).toBeVisible();
		}

		// Software tab (default) shows the OS ID / Port Information group.
		await expect(page.getByText('Port Information')).toBeVisible();

		// Hardware tab surfaces the MAC address field.
		await page.getByRole('tab', {name: 'Hardware'}).click();
		await expect(page.getByText('MAC Address').first()).toBeVisible();

		// Layer 3 tab surfaces the IPv4 Addresses group.
		await page.getByRole('tab', {name: 'Layer 3'}).click();
		await expect(page.getByText('IPv4 Addresses').first()).toBeVisible();
	});

	test('read-only: no add/delete affordances', async ({page}) => {
		await expect(toolbarButton(page, 'Add')).toHaveCount(0);
		await expect(toolbarButton(page, 'Delete')).toHaveCount(0);
	});
});
