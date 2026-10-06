//---------------------------------------------------------
// Rule-detail read-back helpers.
//
// The detail panels render each value as a SingleTextBox: a caption with the
// value under it, not a labelled control. So a value is found from its caption,
// and a caption that is absent is a row the panel chose not to render.
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';

/** The caption element of a detail row, matched on its exact text. */
export function detailCaption(page: Page, label: string): Locator {
	return page.locator('.MuiTypography-caption').filter({hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)});
}

/** The value shown under a detail caption. */
export function detailValue(page: Page, label: string): Locator {
	// caption → its flex row → the Stack that holds the row and the value.
	return detailCaption(page, label).locator('xpath=../..').locator('.MuiTypography-body2');
}
