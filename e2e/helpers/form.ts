//---------------------------------------------------------
// Shared ParamBox / AccordionBox form helpers, hoisted from the
// fw/lb reference specs so every Group-1+ spec drives the same
// metadata-generated forms the same way.
//
// Why the anchored regexes and h6-title accordion lookups exist:
// - ParamBox wraps each control in a Tooltip whose *description* becomes
//   an aria-label on the wrapper div, so a bare getByLabel substring
//   matches both the control and its tooltip. Anchoring on the label
//   (with the optional required-` *` suffix) hits only the real control.
// - AccordionBox wraps its summary in a Tooltip too, and that text
//   hijacks the summary button's accessible name — so accordions are
//   located by the visible h6 title inside, never by button name.
//---------------------------------------------------------
import {expect, Locator, Page} from '@playwright/test';
import {dialog} from './dialogs';

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A ParamBox control located by its exact (label) or (label *) accessible name. */
export function field(page: Page, label: string, root?: Locator): Locator {
	return (root ?? dialog(page)).getByLabel(new RegExp(`^${escapeRe(label)}( \\*)?$`));
}

/** An AccordionBox section located by its visible h6 title. */
export function section(page: Page, title: string | RegExp): Locator {
	return dialog(page).locator('.MuiAccordion-root').filter({has: page.locator('h6', {hasText: title})});
}

/** Expands (idempotently) an AccordionBox section and returns its root. */
export async function expandSection(page: Page, title: string | RegExp): Promise<Locator> {
	const sec = section(page, title);
	const summary = sec.locator('.MuiAccordionSummary-root').first();
	if ((await summary.getAttribute('aria-expanded')) !== 'true') await summary.click();
	return sec;
}

/**
 * Fills a ParamBox whose control type depends on gateway metadata: a field
 * with an enum renders as a Select (combobox), otherwise as a textbox.
 */
export async function setField(page: Page, label: string, value: string, root?: Locator): Promise<void> {
	const f = field(page, label, root);
	if ((await f.getAttribute('role')) === 'combobox') {
		await f.click();
		await page.getByRole('option', {name: value, exact: true}).click();
	} else {
		await f.fill(value);
	}
}

/** True if `btn` settles into a disabled state within `timeout` ms (async validation). */
export async function isEventuallyDisabled(btn: Locator, timeout = 3000): Promise<boolean> {
	try {
		await expect(btn).toBeDisabled({timeout});
		return true;
	} catch {
		return false;
	}
}
