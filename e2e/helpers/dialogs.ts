//---------------------------------------------------------
// Helpers for the app's single global PopUp modal
// (components/modal/PopUp.tsx). MUI Select popovers also
// mount .MuiModal-root nodes, but they append AFTER the
// popup, so .first() always resolves to the PopUp itself.
//---------------------------------------------------------
import {expect, Locator, Page} from '@playwright/test';
import {toolbarButton, ToolbarIcon} from './table';

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

/**
 * Opens a modal and waits for it, retrying a click the app silently dropped.
 *
 * A click on a toolbar button can be swallowed while the DataGrid behind it is
 * still re-rendering: the button is present and enabled, the click reports
 * success, and no dialog ever appears. It surfaces on a different random
 * subset of specs every full run and passes on re-run in isolation, which is
 * the profile of a lost click and not of a product defect. Left bare, it reads
 * as "the New X dialog never opened" and sends the next person hunting a UI bug
 * that does not exist.
 *
 * Retrying is only safe when NOTHING opened. If a modal did open but carries
 * the wrong title, clicking again would stack a second one on top and bury the
 * evidence, so that case fails immediately and reports the heading it actually
 * found — the click worked there, and the app opening the wrong thing is a real
 * defect that must not be retried into a timeout.
 */
export async function openDialog(
	page: Page,
	title: string | RegExp | Locator,
	open: () => Promise<unknown>,
	{attempts = 3, timeout = 5_000}: {attempts?: number; timeout?: number} = {},
): Promise<void> {
	const heading = typeof title === 'string' || title instanceof RegExp ? dialog(page).getByText(title) : title;
	for (let attempt = 1; ; attempt++) {
		await open();
		try {
			await expect(heading).toBeVisible({timeout});
			return;
		} catch (err) {
			if (!(await dialog(page).isVisible().catch(() => false))) {
				if (attempt === attempts) throw err;
				continue; // nothing opened at all — the click was lost, so click again
			}
			// A modal IS up. Give the title one more window before blaming the app:
			// a form section can render a beat after the modal it lives in, and
			// calling that "the wrong dialog" would be a false accusation.
			// (isVisible() would not wait — it answers about right now.)
			try {
				await expect(heading).toBeVisible({timeout});
				return;
			} catch {
				/* still absent — genuinely the wrong dialog, reported below */
			}
			const actual = (await dialog(page).getByRole('heading').first().textContent().catch(() => null))?.trim();
			throw new Error(
				`A dialog opened, but not the expected one${actual ? ` — its heading reads ${JSON.stringify(actual)}` : ''}. ` +
					'This is NOT the lost-click flake: the click landed and the app opened the wrong dialog.',
			);
		}
	}
}

/** `openDialog` for the common case: a DataTable toolbar button opens the modal. */
export async function openToolbarDialog(
	page: Page,
	icon: ToolbarIcon,
	title: string | RegExp | Locator,
	opts?: {attempts?: number; timeout?: number},
): Promise<void> {
	await openDialog(page, title, () => toolbarButton(page, icon).click(), opts);
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
