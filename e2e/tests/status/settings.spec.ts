//---------------------------------------------------------
// Log Settings page spec (docs/E2E_CRUD_TEST_PLAN.md §6 — route instance/settings).
// The Log Level radio group is the one mutation here. Read-modify-restore:
// capture the current level, drive every level through the confirm dialog
// asserting the POST /config/params payload, then restore the original.
// OperParams carries only logLevel, so a partial POST is complete (no
// F-SEC-5 field-wipe risk) and changing verbosity is benign on the testbed.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance, gw, gwJson} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';

type Level = 'debug' | 'info' | 'error' | 'warning';
const LEVELS: Level[] = ['debug', 'info', 'error', 'warning'];
const label = (l: Level) => l.charAt(0).toUpperCase() + l.slice(1);

async function readLevel(): Promise<Level> {
	const data = await gwJson<{logLevel?: Level}>('/config/params');
	return (data.logLevel ?? 'debug') as Level;
}

let instName: string;
let original: Level;

test.describe('Log Settings page (log level)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		original = await readLevel();
	});

	test.afterAll(async () => {
		await gw('POST', '/config/params', {logLevel: original});
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/settings?name=${instName}`); // relative — see baseURL note
		await expect(page.getByRole('heading', {name: 'Log Level'})).toBeVisible({timeout: 20_000});
	});

	test('reflects the current level from /config/params', async ({page}) => {
		await expect(page.getByRole('radio', {name: label(original)})).toBeChecked();
	});

	test('changing to every level POSTs {logLevel} and persists', async ({page}) => {
		// Visit each non-original level, then land back on the original so the
		// testbed is left as found even before the afterAll safety net.
		const sequence: Level[] = [...LEVELS.filter(l => l !== original), original];

		for (const target of sequence) {
			// The just-dismissed Success modal can still be animating out and
			// swallow this click, so retry the click until the confirm dialog
			// actually opens (clicking the same radio again is harmless).
			await expect(async () => {
				await page.getByRole('radio', {name: label(target)}).click();
				await expect(dialog(page).getByRole('heading', {name: 'Log Level Change'})).toBeVisible({timeout: 2000});
			}).toPass({timeout: 15_000});

			const [req] = await Promise.all([
				page.waitForRequest(r => r.method() === 'POST' && /\/config\/params/.test(r.url())),
				dialogButton(page, 'Change').click(),
			]);
			expect(req.postDataJSON()).toEqual({logLevel: target});

			await expectSuccessAndDismiss(page);
			await expect(page.getByRole('radio', {name: label(target)})).toBeChecked();
			expect(await readLevel(), `gateway persisted logLevel=${target}`).toBe(target);
		}
	});
});
