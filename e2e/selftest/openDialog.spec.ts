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
		<div data-table-bar="Route"><button><svg data-testid="AddIcon"></svg></button></div>
		<div id="host"></div>
		<script>
			let n = 0;
			document.querySelector('[data-table-bar] button').addEventListener('click', () => {
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

/**
 * The right dialog, opened with its title and no fields: what a form looks
 * like when the schema read it draws them from fails as it mounts.
 */
async function schemalessForm(page: Page, schema: 'answers 502' | 'gets no answer' | 'is not read'): Promise<void> {
	await page.route('**/meta', route => (schema === 'gets no answer' ? route.abort('connectionrefused') : route.fulfill({status: 502, headers: {'access-control-allow-origin': '*'}, body: ''})));
	await page.setContent(`
		<div data-table-bar="Route"><button><svg data-testid="AddIcon"></svg></button></div>
		<div id="host"></div>
		<script>
			document.querySelector('[data-table-bar] button').addEventListener('click', () => {
				document.querySelector('#host').innerHTML = '<div class="MuiModal-root"><h2>New Route</h2></div>';
				${schema === 'is not read' ? '' : "fetch('http://oam.test/oam/api/v1/instances/gw/meta').catch(() => {});"}
			});
		</script>`);
}

async function failureOf(run: Promise<unknown>): Promise<string> {
	try {
		await run;
	} catch (err: any) {
		return err.message;
	}
	return '';
}

test('a form left empty by a failed schema read is reported as the failed read, not as a wrong dialog', async ({page}) => {
	await schemalessForm(page, 'answers 502');
	const msg = await failureOf(openToolbarDialog(page, 'Add', page.getByLabel('Destination'), {timeout: 300}));
	expect(msg).toContain('GET /oam/api/v1/instances/gw/meta answered 502');
	expect(msg).toContain('"New Route"');
	expect(msg).toContain('NOT the app opening the wrong dialog');
	expect(msg).not.toContain('opened the wrong dialog.');
});

test('a schema read that gets no answer at all is reported the same way', async ({page}) => {
	await schemalessForm(page, 'gets no answer');
	const msg = await failureOf(openToolbarDialog(page, 'Add', page.getByLabel('Destination'), {timeout: 300}));
	expect(msg).toContain('GET /oam/api/v1/instances/gw/meta got no answer');
	expect(msg).toContain('NOT the app opening the wrong dialog');
});

test('missing content with no failed schema read is still the wrong dialog', async ({page}) => {
	// The schema verdict needs evidence: without a failed read the app is
	// what opened the wrong thing, and the read must not be blamed for it.
	await schemalessForm(page, 'is not read');
	const msg = await failureOf(openToolbarDialog(page, 'Add', page.getByLabel('Destination'), {timeout: 300}));
	expect(msg).toContain('not the expected one');
	expect(msg).not.toContain('schema read');
});

test('a failed schema read does not fail a dialog whose expected content is there', async ({page}) => {
	await schemalessForm(page, 'answers 502');
	await openToolbarDialog(page, 'Add', 'New Route', {timeout: 300});
	await expect(dialog(page)).toBeVisible();
});

test('openDialog also drives a non-toolbar opener', async ({page}) => {
	await harness(page, 2);
	await openDialog(page, 'New Route', () => page.locator('[data-table-bar] button').click());
	await expect(dialog(page)).toBeVisible();
});
