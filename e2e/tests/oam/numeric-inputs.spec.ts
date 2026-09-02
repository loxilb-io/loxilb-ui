//---------------------------------------------------------
// raw-string numeric input, in a browser.
//
// The defect this pins was `parseInt(value) || 0` on 17 form sites. Its worst
// instance is the one exercised below: typing a typo into "Rate Limit (req/s)"
// silently produced 0 — which that field defines as UNLIMITED. A slip of the
// keyboard turned a rate limit off, with no error, no highlight, and a payload
// the operator never chose.
//
// The unit suite (src/components/input/NumericInputs.test.tsx) pins the
// evaluator and the controls. This pins the property an operator can actually
// observe: that what they typed is what the field holds, and that a field the
// app cannot interpret blocks submission instead of inventing a value.
//
// Nothing is written: the BGP cases never press Apply, and the API-key case
// asserts the dialog's Add button is DISABLED — the request is never made.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, openDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {toolbarButton} from '../../helpers/table';

let instName = '';

test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

// BGP data calls answer 403 on this testbed (BGP mode is disabled) — see
// network/bgp.spec.ts. The FORM still renders, and these assertions are
// purely client-side, so the 403 is irrelevant here beyond its console noise.
function allowBgpDisabled(consoleGuard: {allow(p: RegExp): void}) {
	consoleGuard.allow(/Failed to load resource/i);
	consoleGuard.allow(/BGP mode is disabled/i);
	consoleGuard.allow(/Capacity insufficient/i);
	consoleGuard.allow(/403/);
}

//---------------------------------------------------------
// 1. A page-level required field with a range: BGP Local AS
//---------------------------------------------------------
// Spec: required, 1 .. 4294967295. 0 was never a valid AS, which is what made
// the old `|| 0` coercion so misleading — it produced an invalid value AND
// then blamed the user for a "missing" field.

test.describe('BGP Local AS — raw text is the field, not a number the app guessed', () => {
	const bgpGlobal = () => `instance/network/bgp/global?name=${instName}`;
	const root = (page: import('@playwright/test').Page) => page.locator('form, body').first();
	const localAs = (page: import('@playwright/test').Page) => field(page, 'Local AS', root(page));

	test('unparseable text is KEPT and named — never silently converted to 0', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await page.goto(bgpGlobal());
		await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});

		await localAs(page).fill('abc');
		// The single most important assertion in this file: the old code showed 0.
		await expect(localAs(page), 'garbage must remain visible as typed, not become 0').toHaveValue('abc');
		await expect(page.getByText('Must be a whole number.')).toBeVisible();
	});

	test('a partial parse is not accepted either — "12a" does not become 12', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await page.goto(bgpGlobal());
		await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});

		await localAs(page).fill('12a');
		await expect(localAs(page), 'parseInt would have taken the leading 12 and dropped the rest').toHaveValue('12a');
		await expect(page.getByText('Must be a whole number.')).toBeVisible();
	});

	test('the field can be cleared and stay cleared — an empty box is representable', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await page.goto(bgpGlobal());
		await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});

		await localAs(page).fill('65001');
		await expect(localAs(page)).toHaveValue('65001');
		await localAs(page).fill('');
		// Under `|| 0` the box snapped to 0 the instant it emptied, so an
		// operator could never delete a value in order to retype it.
		await expect(localAs(page), 'clearing the field must not repopulate it with 0').toHaveValue('');
	});

	test('an out-of-range value is rejected on its range, not silently rewritten', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await page.goto(bgpGlobal());
		await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});

		await localAs(page).fill('0');
		// 0 parses fine — it fails the SPEC. The message has to say which,
		// because "0" is exactly what the old coercion produced from garbage
		// and the two cases were indistinguishable afterwards.
		await expect(localAs(page)).toHaveValue('0');
		await expect(page.getByText('Must be at least 1.')).toBeVisible();
		await expect(page.getByText('Must be a whole number.')).toHaveCount(0);
	});

	test('a valid value is accepted with no complaint', async ({page, consoleGuard}) => {
		allowBgpDisabled(consoleGuard);
		await page.goto(bgpGlobal());
		await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});

		await localAs(page).fill('65001');
		await expect(localAs(page)).toHaveValue('65001');
		await expect(page.getByText('Must be a whole number.')).toHaveCount(0);
		await expect(page.getByText('Must be at least 1.')).toHaveCount(0);
	});
});

//---------------------------------------------------------
// 2. The zero-sentinel field: AI API key rate limits
//---------------------------------------------------------
// Here 0 is a MEANINGFUL value ("unlimited"), which is what made the old
// behaviour dangerous rather than merely annoying: coercion produced the one
// value that turns the control off.

test.describe('AI API key rate limits — 0 means unlimited, so garbage must never become 0', () => {
	const apiKeyPage = () => `instance/ai/apikey?name=${instName}`;

	async function openAddDialog(page: import('@playwright/test').Page): Promise<void> {
		await page.goto(apiKeyPage());
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 30_000});
		await openDialog(page, /New AI API Key/, () => toolbarButton(page, 'Add').click());
	}

	test('garbage in Rate Limit is kept, flagged, and BLOCKS the create', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		await openAddDialog(page);

		await field(page, 'Rate Limit (req/s)').fill('abc');
		await expect(field(page, 'Rate Limit (req/s)'), 'garbage must not become 0 — 0 is "unlimited" on this field').toHaveValue('abc');
		await expect(dialog(page).getByText('Must be a whole number.')).toBeVisible();
		// The decisive half: an uninterpretable field must stop the request,
		// not send a guess. Under the old code this button stayed enabled and
		// the create went out carrying rate_limit_rps omitted (the >0 spread),
		// i.e. unlimited — the exact outcome the operator was avoiding.
		await expect(dialogButton(page, 'Add'), 'an uninterpretable numeric field must block submission').toBeDisabled();

		await dialogButton(page, 'Cancel').click();
	});

	test('a deliberate 0 is still accepted — the sentinel survives the fix', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		await openAddDialog(page);

		// Parity guard. A fix that made every 0 invalid would pass every
		// assertion above and quietly remove the ability to say "unlimited".
		await field(page, 'Rate Limit (req/s)').fill('0');
		await expect(field(page, 'Rate Limit (req/s)')).toHaveValue('0');
		await expect(dialog(page).getByText('Must be a whole number.')).toHaveCount(0);
		await expect(dialog(page).getByText('Must be at least 0.')).toHaveCount(0);

		await dialogButton(page, 'Cancel').click();
	});

	test('every rate field behaves the same way — the fix is not one-off', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		await openAddDialog(page);

		for (const label of ['Burst Size', 'Tokens / Minute']) {
			await field(page, label).fill('-');
			await expect(field(page, label), `${label} must keep what was typed`).toHaveValue('-');
			await expect(dialogButton(page, 'Add'), `${label} must block submission while unparseable`).toBeDisabled();
			await field(page, label).fill('0');
		}

		await dialogButton(page, 'Cancel').click();
	});
});
