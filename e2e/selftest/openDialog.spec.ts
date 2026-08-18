//---------------------------------------------------------
// Self-tests for the openDialog / openToolbarDialog helpers.
//---------------------------------------------------------
// These do NOT touch the app or the testbed. They drive a hand-built page via
// page.setContent(), so the swallowed click that only happens sporadically
// against the real DataGrid becomes deterministic and can be asserted on.
//
// Why this file exists: the retry it guards is invisible when it works. If it
// silently regressed to a single click, nothing here would go red and the only
// symptom would be the flake coming back — as a different random handful of
// specs each run, which is exactly how it went undiagnosed for so long.
//
// Verified to fail without the fix: forcing `attempts = 1` turns the two
// retry cases red and leaves the other two green.
import {expect, Page, test} from '@playwright/test';
import {dialog, openDialog, openToolbarDialog} from '../helpers/dialogs';

/** A toolbar whose Add button silently ignores its first `swallow` clicks. */
async function harness(page: Page, swallow: number, title = 'New Route'): Promise<void> {
	await page.setContent(`
		<div id="table-bar"><button><svg data-testid="AddIcon"></svg></button></div>
		<div id="host"></div>
		<script>
			let n = 0;
			document.querySelector('#table-bar button').addEventListener('click', () => {
				if (++n <= ${swallow}) return;            // the lost click
				document.querySelector('#host').innerHTML =
					'<div class="MuiModal-root"><h2>${title}</h2></div>';
			});
		</script>`);
}

test('recovers from a swallowed click', async ({page}) => {
	await harness(page, 1);
	await openToolbarDialog(page, 'Add', 'New Route');
	await expect(dialog(page)).toBeVisible();
});

test('a dialog that never opens still fails', async ({page}) => {
	await harness(page, 99);
	await expect(openToolbarDialog(page, 'Add', 'New Route', {timeout: 300})).rejects.toThrow();
});

test('a WRONG dialog fails fast and names what opened, instead of being retried', async ({page}) => {
	// Retrying here would stack a second modal and bury the evidence; the click
	// landed, so this is a product defect and must not be papered over.
	await harness(page, 0, 'Completely Different Dialog');
	let msg = '';
	try {
		await openToolbarDialog(page, 'Add', 'New Route', {timeout: 300});
	} catch (err: any) {
		msg = err.message;
	}
	expect(msg).toContain('not the expected one');
	expect(msg).toContain('Completely Different Dialog');
	expect(msg).toContain('NOT the lost-click flake');
});

test('openDialog also drives a non-toolbar opener', async ({page}) => {
	await harness(page, 2);
	await openDialog(page, 'New Route', () => page.locator('#table-bar button').click());
	await expect(dialog(page)).toBeVisible();
});
