import {expect, type Locator, type Page} from '@playwright/test';

/** Wait for React's controlled selection and its detail panel after a pointer action. */
export async function toggleProcessSelection(page: Page, row: Locator, selected: boolean) {
	const checkbox = row.getByRole('checkbox');
	if (selected) await expect(checkbox).not.toBeChecked();
	else await expect(checkbox).toBeChecked();
	await checkbox.click();
	if (selected) {
		await expect(checkbox).toBeChecked();
		await expect(page.getByText('Resource Usage', {exact: true})).toBeVisible();
		await expect(page.getByText('CPU Usage', {exact: true})).toBeVisible();
		await expect(page.getByText('Memory Status', {exact: true})).toBeVisible();
	} else {
		await expect(checkbox).not.toBeChecked();
		await expect(page.getByText('Resource Usage', {exact: true})).toHaveCount(0);
	}
}
