//---------------------------------------------------------
// Helpers for the app's single global PopUp modal
// (components/modal/PopUp.tsx). MUI Select popovers also
// mount .MuiModal-root nodes, but they append AFTER the
// popup, so .first() always resolves to the PopUp itself.
//---------------------------------------------------------
import {expect, Locator, Page} from '@playwright/test';

export function dialog(page: Page): Locator {
	return page.locator('.MuiModal-root').first();
}

export function dialogButton(page: Page, name: string): Locator {
	return dialog(page).getByRole('button', {name, exact: true});
}

/** The PopUp's h6 title (as opposed to matching body text too). */
export function dialogTitle(page: Page, title: string): Locator {
	return dialog(page).getByRole('heading', {name: title});
}

/** Pick a value in a ParamBox dropdown (MUI Select) inside the popup.
 * `nth` disambiguates repeated dropdowns (e.g. per-endpoint EP Role). */
export async function selectOption(page: Page, label: string, optionName: string | RegExp, nth = 0): Promise<void> {
	// The combobox's accessible name is "<label> <selected value>", so
	// anchor on the label prefix only.
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	await dialog(page).getByRole('combobox', {name: new RegExp(`^${escaped}`)}).nth(nth).click();
	// The option listbox portals into its own (later) modal root. Exact match
	// for strings — 'onearm' must not hit 'hostonearm', 'HTTP' not 'HTTPS'.
	await page.getByRole('option', {name: optionName, exact: typeof optionName === 'string'}).click();
}

/** The "Success" popup every mutation ends on; dismisses it. */
export async function expectSuccessAndDismiss(page: Page): Promise<void> {
	await expect(dialogTitle(page, 'Success')).toBeVisible();
	await dialogButton(page, 'OK').click();
	await expect(dialog(page)).toBeHidden();
}

/** The "Error" popup a surfaced gateway failure ends on; dismisses it. */
export async function expectErrorAndDismiss(page: Page): Promise<void> {
	await expect(dialogTitle(page, 'Error')).toBeVisible();
	await dialogButton(page, 'OK').click();
	await expect(dialog(page)).toBeHidden();
}

/** Confirms the "WARNING!! Delete Item" popup. */
export async function confirmDelete(page: Page): Promise<void> {
	await expect(dialogTitle(page, 'WARNING!! Delete Item')).toBeVisible();
	await dialogButton(page, 'Delete').click();
}
