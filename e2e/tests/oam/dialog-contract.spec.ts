//---------------------------------------------------------
// shared dialog contract,
// in a browser.
//
// The old shared PopUp was a bare MUI Modal with `open` and nothing else:
//   - no onClose, so Escape and the backdrop were DEAD — a keyboard-only
// operator could not dismiss a confirmation at all;
//   - handleYes() closed the dialog and THEN started the (async) mutation, so
//     the confirmation vanished while the work was still running and could be
// re-opened and re-submitted;
//   - callers could not pass a Cancel handler at all.
//
// Every case here dismisses rather than confirms, and asserts on a REQUEST
// COUNTER: "the dialog closed" is not the property that matters — "the action
// did not run" is. The one case that must confirm (busy) intercepts its
// request, so nothing reaches the testbed either.
//---------------------------------------------------------
import {Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, openDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {toolbarButton} from '../../helpers/table';

let instName = '';

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

function allowBgpDisabled(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/BGP mode is disabled/i);
	consoleGuard.allow(/Capacity insufficient/i);
	consoleGuard.allow(/403/);
}

//---------------------------------------------------------
// A confirm dialog with a real Yes and a real Cancel
//---------------------------------------------------------
// BGP Global Apply is the safest confirm in the product to drive: the page is
// read-only until Apply is confirmed, and this testbed answers every BGP write
// 403 anyway. None of these cases ever presses Apply.
const BGP_WRITE = '**/netlox/v1/config/bgp/global';

/** Counts writes the dialog let through. The number must stay 0 in every dismissal case. */
async function countBgpWrites(page: import('@playwright/test').Page): Promise<{n: number}> {
	const writes = {n: 0};
	await page.route(BGP_WRITE, async (route: Route) => {
		if (route.request().method() === 'POST') writes.n++;
		return route.continue();
	});
	return writes;
}

/** Fills the two required fields and opens the Apply confirmation. */
async function openApplyConfirm(page: import('@playwright/test').Page): Promise<void> {
	await page.goto(`instance/network/bgp/global?name=${instName}`);
	await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});
	const root = page.locator('body');
	await field(page, 'Router ID', root).fill('10.0.0.1');
	await field(page, 'Local AS', root).fill('65001');
	await openDialog(page, /Apply BGP Global Config/, () => page.getByRole('button', {name: 'Apply', exact: true}).first().click());
}

test.describe('the shared confirmation dialog', () => {
	test('is a real dialog with an accessible name and description', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await openApplyConfirm(page);

		// role=dialog is what makes a screen reader announce it as a dialog and
		// trap focus in it. The old Modal exposed none of this.
		const box = page.getByRole('dialog');
		await expect(box).toBeVisible();
		await expect(box).toHaveAttribute('aria-labelledby', /.+/);
		await expect(box).toHaveAttribute('aria-describedby', /.+/);
		await expect(box.getByRole('heading', {name: 'Apply BGP Global Config'})).toBeVisible();

		// Focus must be INSIDE the dialog on open, and on the safe action —
		// pressing Enter reflexively must not perform the mutation.
		await expect(dialogButton(page, 'Cancel')).toBeFocused();
	});

	test('Escape dismisses it AND the action does not run', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		const writes = await countBgpWrites(page);
		await openApplyConfirm(page);

		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		// The half that matters. A dialog that closes but still fires its
		// action would satisfy the assertion above and be far worse than one
		// that never closed.
		expect(writes.n, 'Escape must abandon the operation, not perform it').toBe(0);
	});

	test('a backdrop click dismisses it AND the action does not run', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		const writes = await countBgpWrites(page);
		await openApplyConfirm(page);

		// Click well outside the paper — the backdrop covers the viewport.
		await page.mouse.click(5, 5);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(writes.n, 'a backdrop dismissal must abandon the operation').toBe(0);
	});

	test('Cancel dismisses it AND the action does not run', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		const writes = await countBgpWrites(page);
		await openApplyConfirm(page);

		await dialogButton(page, 'Cancel').click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(writes.n, 'Cancel must abandon the operation').toBe(0);
	});

	test('the whole dialog is reachable and dismissable from the keyboard alone', async ({page, consoleGuard}) => {
		// a confirmation an operator cannot dismiss without a mouse is a
		// dead end. This drives the dialog with no pointer input at all.
		allowBgpDisabled(consoleGuard);
		const writes = await countBgpWrites(page);
		await openApplyConfirm(page);

		await page.keyboard.press('Tab'); // focus moves within the dialog, never out of it
		await expect(dialog(page).locator(':focus')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(writes.n).toBe(0);
	});
});

//---------------------------------------------------------
// In-flight semantics
//---------------------------------------------------------
// The old dialog closed FIRST and ran the mutation afterwards, so the window
// between "operator confirmed" and "server answered" had no representation at
// all: the dialog was gone, the buttons were re-armable, and a second click
// re-submitted the same mutation.

test('while the action is in flight the dialog stays up, locked, and Escape is inert', async ({page, consoleGuard}) => {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/status of 5\d\d/i);

	// The create is answered slowly and then refused, so the gateway is never
	// asked to make anything: the assertions below all happen inside the delay.
	let submissions = 0;
	await page.route('**/netlox/v1/config/ai/apikey**', async (route: Route) => {
		if (route.request().method() !== 'POST') return route.continue();
		submissions++;
		await new Promise(r => setTimeout(r, 8_000));
		return route.fulfill({
			status: 500,
			headers: {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
			body: JSON.stringify({result: 'e2e: deliberately refused'}),
		});
	});

	await page.goto(`instance/ai/apikey?name=${instName}`);
	await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 30_000});
	await openDialog(page, /New AI API Key/, () => toolbarButton(page, 'Add').click());

	await field(page, 'Tenant ID').fill('e2e-dialog-contract');
	await field(page, 'Name').fill('e2e-dialog-contract');
	const add = dialogButton(page, 'Add');
	await expect(add).toBeEnabled();
	await add.click();

	// Mid-flight: the dialog is still on screen and both actions are locked.
	// The confirm button swaps its label for a busy indicator — that swap IS
	// the in-flight semantics the old dialog had no way to express (it had
	// already closed by now). It is located structurally: a progressbar child
	// does not contribute to a button's accessible name, so the button is
	// nameless while busy rather than named "Loading…".
	await expect(page.getByRole('dialog')).toBeVisible();
	const busy = dialog(page).locator('button:has([role="progressbar"])');
	await expect(busy, 'the confirm action must show that it is running').toBeVisible();
	await expect(busy, 'the confirm button must lock while the mutation runs').toBeDisabled();
	await expect(dialogButton(page, 'Cancel'), 'Cancel must lock too — the request cannot be recalled').toBeDisabled();

	// Escape is inert while busy: dismissing here would strand a running
	// mutation with no UI attached to its result.
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog'), 'Escape must not dismiss a dialog whose action is still running').toBeVisible();

	// And the whole point of the lock: exactly one request, however many times
	// the operator clicks.
	await busy.click({force: true}).catch(() => {});
	await page.waitForTimeout(500);
	expect(submissions, 'a locked dialog must not be able to re-submit').toBe(1);

	// It settles rather than hanging: the busy indicator clears once the
	// server answers, and the refusal is reported instead of swallowed.
	await expect(busy, 'the dialog must leave the busy state').toHaveCount(0, {timeout: 30_000});
	// The refusal surfaces in the shared ERROR dialog — a second component with
	// the same shape as PopUp. It was missed by the original dialog work and
	// had no dialog semantics at all (a bare MUI Modal announces as an unnamed
	// group), which is why this case asserts the contract on it explicitly
	// rather than only checking that some text appeared.
	const errorBox = page.getByRole('dialog');
	await expect(errorBox, 'the refusal must be reported in a real dialog').toBeVisible({timeout: 20_000});
	await expect(errorBox).toHaveAttribute('aria-modal', 'true');
	await expect(errorBox).toHaveAttribute('aria-labelledby', /.+/);
	await expect(errorBox).toHaveAttribute('aria-describedby', /.+/);
	await expect(errorBox.getByText(/Failed to add/i), 'the refusal must name what failed').toBeVisible();
});
