//---------------------------------------------------------
// Device Details page spec.
// Read-only dashboard. Beyond the render/API-match checks this pins the
// F-STATUS-1 regression: "Boot Up" must be derived from the RAW uptime
// seconds. The page used to re-parse the already-formatted uptime string
// ("2d 21h…") so parseFloat("2d") → 2 and boot time collapsed to ≈now.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {gwJson} from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';

/** Mirror of the connector's clean_string (trim + strip newlines). */
function clean(s: string | undefined): string {
	return (s ?? '').replace(/\\[nlr]/g, '').replace(/[\n\r]/g, '').trim();
}

let instName: string;

test.describe('@loxilb Device Details page (read-only)', () => {
	test.beforeAll(async () => {
		instName = await requireLoxilbInstance();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/status/device?name=${instName}`); // relative — see baseURL note
		// "Device Details" also names the side-menu item — scope to the content pane.
		await expect(page.locator('#content-area').getByRole('heading', {name: 'Device Details'})).toBeVisible({timeout: 20_000});
	});

	test('renders machine-id / host / boot-id matching /status/device', async ({page}) => {
		const dev = await gwJson<{machineID?: string; hostName?: string; bootID?: string}>('/status/device');

		for (const [label, value] of [
			// machineID is declared by both backend specs but comes from
			// /etc/machine-id, which containerized deployments may lack (the
			// loxilb testbed container omits the field entirely) — assert
			// UI↔REST consistency, not testbed provisioning.
			['Machine ID', clean(dev.machineID)],
			['Host Name', clean(dev.hostName)],
			['Boot ID', clean(dev.bootID)],
		] as const) {
			if (label !== 'Machine ID') {
				expect(value, `${label} should be non-empty on the testbed`).not.toBe('');
			}
			if (value !== '') {
				await expect(page.getByText(value, {exact: true})).toBeVisible();
			}
		}
	});

	test('F-STATUS-1: Boot Up is now − uptime, not ≈now', async ({page}) => {
		const dev = await gwJson<{uptime?: string}>('/status/device');
		const uptimeSeconds = parseFloat(String(dev.uptime ?? '').trim().split(' ')[0] ?? '');
		expect(Number.isFinite(uptimeSeconds) && uptimeSeconds > 3600, 'testbed uptime should be > 1h').toBe(true);

		// The value Typography is the sibling after the label's row. Wait for the
		// device query to resolve (a date appears) before reading.
		const bootValue = page.locator('#content-area .MuiTypography-caption', {hasText: /^Boot Up$/}).locator('xpath=../following-sibling::*[1]');
		await expect(bootValue).toHaveText(/\d{4}/, {timeout: 15_000});

		// Compare display to an independently-derived expectation, both formatted
		// by the SAME browser locale, truncated to the minute so the ~1s drift
		// between the connector's fetch and this read can't flake. Under the bug
		// Boot Up read ≈now (off by days) and this mismatches.
		const stripSecs = (str: string) => str.replace(/(\d{1,2}:\d{2}):\d{2}/, '$1');
		const displayed = stripSecs((await bootValue.innerText()).trim());
		const expected = stripSecs(await page.evaluate(secs => new Date(Date.now() - secs * 1000).toLocaleString(), uptimeSeconds));

		expect(displayed, 'Boot Up must equal now − uptime (F-STATUS-1)').toBe(expected);
	});
});
