//---------------------------------------------------------
// Observability cadence preference — the claimed-customization procedure
// (change it, verify it persisted, reload, verify it survived, restore).
// One global preference drives the ONE shared snapshot query; the selector
// on any observability page changes every consumer, and an untrusted stored
// value must fall back to the honest 10 s default rather than being adopted.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

const KEY = 'observability_cadence_ms';

test('cadence selection persists across reload and restores', async ({page}) => {
	const inst = await activeInstance();
	await page.goto(`instance/observability/ai?name=${encodeURIComponent(inst.name)}`);

	const selector = page.getByRole('combobox', {name: /Refresh interval/});
	await expect(selector).toBeVisible({timeout: 20_000});
	// Default claimed by the product: 10 s.
	await expect(selector).toHaveText('10s');

	await selector.click();
	await page.getByRole('option', {name: '30s'}).click();
	await expect(selector).toHaveText('30s');
	expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('30000');

	await page.reload();
	await expect(page.getByRole('combobox', {name: /Refresh interval/})).toHaveText('30s', {timeout: 20_000});

	// Restore the default so this spec leaves no preference behind.
	await page.getByRole('combobox', {name: /Refresh interval/}).click();
	await page.getByRole('option', {name: '10s'}).click();
	expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('10000');
});

test('an untrusted stored cadence is rejected in favor of the default', async ({page}) => {
	const inst = await activeInstance();
	await page.goto(`instance/observability/ai?name=${encodeURIComponent(inst.name)}`);
	await expect(page.getByRole('combobox', {name: /Refresh interval/})).toBeVisible({timeout: 20_000});

	// A hand-edited or older-build value outside the pinned option set.
	await page.evaluate(k => localStorage.setItem(k, '7000'), KEY);
	await page.reload();
	await expect(page.getByRole('combobox', {name: /Refresh interval/})).toHaveText('10s', {timeout: 20_000});

	await page.evaluate(k => localStorage.removeItem(k), KEY);
});
