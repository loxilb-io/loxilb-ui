import {test, expect} from '../fixtures';
import {toggleProcessSelection} from '../helpers/processSelection';

test.beforeEach(async ({context}) => {
	// An accidental real backend request must fail locally, never reach a host.
	await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4179'
		? route.continue() : route.abort('blockedbyclient'));
});

test('real Process page survives repeated controlled selection, deselection and refresh', async ({page}) => {
	await page.goto('/e2e/local/process/');
	const row = page.getByRole('row').filter({has: page.getByRole('gridcell', {name: 'loxilb', exact: true})});
	await expect(row).toHaveCount(1);
	for (let cycle = 0; cycle < 10; cycle++) {
		await toggleProcessSelection(page, row, true);
		await toggleProcessSelection(page, row, false);
	}
	await toggleProcessSelection(page, row, true);
	await page.getByRole('button', {name: 'Refresh Process'}).click();
	await expect(row.getByRole('checkbox')).not.toBeChecked();
	await expect(page.getByText('Resource Usage', {exact: true})).toHaveCount(0);
	await toggleProcessSelection(page, row, true);
});

test('a successful empty process fixture has no selectable row or detail panel', async ({page}) => {
	await page.goto('/e2e/local/process/?empty');
	await expect(page.getByText('No Process entries yet', {exact: true}).first()).toBeVisible();
	await expect(page.getByRole('gridcell', {name: 'loxilb', exact: true})).toHaveCount(0);
	await expect(page.getByText('Resource Usage', {exact: true})).toHaveCount(0);
});
