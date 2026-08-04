//---------------------------------------------------------
// Helpers for the shared DataTable (MUI DataGrid) used by
// every list page. Toolbar buttons are icon-only inside a
// Tooltip (no accessible name), so they are located by the
// MUI icon's data-testid. Edit uses ModeIcon.
//---------------------------------------------------------
import {expect, Locator, Page} from '@playwright/test';

// 'Block' is the disable action some singleton-config tables (e.g. Security
// Rate Limiting) render in place of Delete — reversible disable, not removal.
type ToolbarIcon = 'Add' | 'Delete' | 'Refresh' | 'Mode' | 'Block';

export function toolbarButton(page: Page, icon: ToolbarIcon): Locator {
	return page.locator(`#table-bar button:has([data-testid="${icon}Icon"])`).first();
}

export function grid(page: Page): Locator {
	return page.locator('.MuiDataGrid-root').first();
}

export function rowByText(page: Page, text: string | RegExp): Locator {
	return grid(page).locator('.MuiDataGrid-row').filter({hasText: text});
}

/**
 * The grid defaults to 5 rows/page; widen so row lookups and multi-select
 * see everything on one page.
 */
export async function showAllRows(page: Page): Promise<void> {
	const pager = grid(page).getByRole('combobox', {name: /rows per page/i});
	if ((await pager.count()) === 0) return;
	await pager.click();
	await page.getByRole('option', {name: '25'}).click();
}

/**
 * Scrolls the DataGrid's virtual scroller to the bottom so bottom-sorted rows
 * render. MUI DataGrid virtualizes — on a long list (e.g. the ~20-route table)
 * a row that sorts last is simply not in the DOM until scrolled into the render
 * window. Our doc-range test entities always sort to the end, so this brings
 * them in. No-op for short lists (content already fits, scrollTop clamps to 0).
 */
export async function scrollGridToBottom(page: Page): Promise<void> {
	const scroller = grid(page).locator('.MuiDataGrid-virtualScroller');
	if ((await scroller.count()) === 0) return;
	await scroller.evaluate(el => {
		el.scrollTop = el.scrollHeight;
	});
	await page.waitForTimeout(150); // let virtualization render the newly-visible rows
}

/** Scrolls the CURRENT grid page top→bottom in overlapping steps until a row
 * matching `text` renders (MUI DataGrid virtualizes rows out of the DOM). */
async function scanCurrentPage(page: Page, text: string | RegExp): Promise<boolean> {
	if ((await rowByText(page, text).count()) > 0) return true;
	const scroller = grid(page).locator('.MuiDataGrid-virtualScroller');
	if ((await scroller.count()) === 0) return false;
	const {scrollHeight, clientHeight} = await scroller.evaluate(el => ({scrollHeight: el.scrollHeight, clientHeight: el.clientHeight}));
	const step = Math.max(120, Math.floor(clientHeight * 0.8));
	for (let top = 0; top <= scrollHeight; top += step) {
		await scroller.evaluate((el, t) => {
			el.scrollTop = t;
		}, top);
		await page.waitForTimeout(100);
		if ((await rowByText(page, text).count()) > 0) return true;
	}
	return (await rowByText(page, text).count()) > 0;
}

/**
 * Reveals a row matching `text`, returning whether it was found. Covers BOTH
 * virtualization (scroll scan) and pagination: showAllRows caps at 25
 * rows/page (the DataTable's largest page size), and on the live testbed a
 * table can outgrow that mid-run — e.g. the route table gains gateway
 * auto-created /32s from earlier LB specs, pushing a seeded row onto page 2
 * where the old single-page scan could never see it. Walks the pager from the
 * first page; the grid is left on the page where the row was found (or the
 * last page), so follow-up row actions keep working.
 */
export async function revealRow(page: Page, text: string | RegExp): Promise<boolean> {
	const prevBtn = grid(page).getByRole('button', {name: /go to previous page/i});
	const nextBtn = grid(page).getByRole('button', {name: /go to next page/i});
	// Rewind to page 1 (bounded) — a prior lookup may have parked the grid on
	// a later page where a freshly-created row would never appear.
	for (let i = 0; i < 40 && (await prevBtn.isEnabled().catch(() => false)); i++) {
		await prevBtn.click();
		await page.waitForTimeout(100);
	}
	for (let pageNo = 0; pageNo < 40; pageNo++) {
		if (await scanCurrentPage(page, text)) return true;
		if (!(await nextBtn.isEnabled().catch(() => false))) return false;
		await nextBtn.click();
		await page.waitForTimeout(150); // let the grid swap pages
	}
	return false;
}

export async function selectRowByText(page: Page, text: string | RegExp): Promise<void> {
	await revealRow(page, text);
	const row = rowByText(page, text);
	await expect(row).toHaveCount(1);
	await row.getByRole('checkbox').check();
}

/**
 * Selects a row on a hideCheckbox table by clicking a non-link cell (link
 * cells navigate away). Row-click selection is single-select only — these
 * tables have no bulk-select affordance. Pass the cell's column field
 * (`data-field`) to click; defaults to the implicit `id` cell.
 */
export async function selectRowByClick(page: Page, text: string | RegExp, field = 'id'): Promise<void> {
	const row = rowByText(page, text);
	await expect(row).toHaveCount(1);
	await row.locator(`[data-field="${field}"]`).first().click();
}

/** Refresh via the toolbar and wait for a row matching `text` to appear.
 * 8 attempts ≈ 12s of refresh budget: the shared live testbed can render a
 * just-created row late under load (persisted react-query cache + poll
 * timing), and a tight budget turned those into false-negative failures. */
export async function refreshUntilRow(page: Page, text: string | RegExp, attempts = 8): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		if (await revealRow(page, text)) return; // long lists virtualize rows out
		await toolbarButton(page, 'Refresh').click();
		await page.waitForTimeout(1500);
	}
	await revealRow(page, text);
	await expect(rowByText(page, text).first()).toBeVisible();
}

/**
 * Like refreshUntilRow but for tables with no Refresh toolbar button (e.g.
 * VXLAN): re-fetch by reloading the page instead of clicking Refresh.
 */
export async function reloadUntilRow(page: Page, text: string | RegExp, attempts = 5): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		if (await revealRow(page, text)) return;
		await page.reload();
		await page.waitForTimeout(1000);
	}
	await revealRow(page, text);
	await expect(rowByText(page, text).first()).toBeVisible();
}

/** reloadUntilRow's inverse — reload until no row matches `text`. */
export async function reloadUntilGone(page: Page, text: string | RegExp, attempts = 5): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		await page.reload();
		await page.waitForTimeout(1000);
		if (!(await revealRow(page, text))) return;
	}
	await expect(rowByText(page, text)).toHaveCount(0);
}

/** Refresh via the toolbar and wait for rows matching `text` to disappear. */
export async function refreshUntilGone(page: Page, text: string | RegExp, attempts = 5): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		await toolbarButton(page, 'Refresh').click();
		await page.waitForTimeout(1500);
		if (!(await revealRow(page, text))) return;
	}
	await expect(rowByText(page, text)).toHaveCount(0);
}
