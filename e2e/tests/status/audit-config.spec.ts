//---------------------------------------------------------
// Audit Trail page against the live gateway (AUDCFG-E2E-08).
//---------------------------------------------------------
// The page must show the policy the gateway holds, and a save must go the
// whole way: through the management backend as an administrator, to the
// gateway, and back as a readback.
//
// ⚠️ The save here sends the values the gateway ALREADY holds. The gateway
// treats a policy with no changed field as nothing to do, so the testbed's
// audit policy is the same before and after, whatever it was.
import {expect, test} from '../../fixtures';
import {activeInstance, gw} from '../../helpers/api';

const FIELDS: [string, string][] = [
	['max_segment_bytes', 'Seal a segment at (bytes)'],
	['max_segment_age_seconds', 'Seal a segment after (seconds)'],
	['retention_max_age_seconds', 'Delete sealed segments older than (seconds)'],
	['retention_max_bytes', 'Keep at most (bytes of sealed segments)'],
	['retention_reserve_bytes', 'Free space to keep on the audit filesystem (bytes)'],
	['retention_max_prune_per_pass', 'Deletions per retention pass'],
];

test.describe('@gw Audit Trail page (live)', () => {
	test('AUDCFG-E2E-08: the page shows the gateway\'s policy, and an unchanged save is confirmed by its readback', async ({page}) => {
		const probe = await gw('GET', '/audit/policy');
		test.skip(probe.status === 404, 'this gateway predates the audit API (/audit/policy answered 404)');
		expect(probe.status, '/audit/policy as the E2E admin').toBe(200);
		const before = await probe.json();
		test.skip(Object.keys(before).length === 0, 'this gateway has no audit writer (/audit/policy answered {})');

		const instName = (await activeInstance()).name;
		const uiRead = page.waitForResponse(resp => /\/audit\/policy$/.test(new URL(resp.url()).pathname) && resp.request().method() === 'GET');
		await page.goto(`instance/maintenance/audit?name=${instName}`);
		expect((await uiRead).status(), 'the UI\'s own policy read').toBe(200);

		const section = page.getByTestId('audit-policy');
		for (const [field, label] of FIELDS) {
			// Absent is 0, and the prune count in use is at least 1.
			const expected = field === 'retention_max_prune_per_pass' ? before[field] || 1 : (before[field] ?? 0);
			await expect(section.getByText(label, {exact: true}).locator('xpath=following-sibling::*[1]'), field).toHaveText(String(expected));
		}

		await section.getByRole('button', {name: 'Change', exact: true}).click();
		const posted = page.waitForResponse(resp => /\/audit\/policy$/.test(new URL(resp.url()).pathname) && resp.request().method() === 'POST');
		await page.getByRole('dialog').getByRole('button', {name: 'Save'}).click();
		expect((await posted).status(), 'the policy write as an administrator').toBe(204);
		await expect(page.getByText('Saved. The gateway reads back what was sent.')).toBeVisible();

		expect(await (await gw('GET', '/audit/policy')).json(), 'the gateway holds the same policy as before').toEqual(before);
	});
});
