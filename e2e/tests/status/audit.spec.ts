//---------------------------------------------------------
// System page — audit REST signals against the live gateway (AUD-E2E-07).
//---------------------------------------------------------
// The page must say what the gateway says: writer running or not, each sink
// that is not sending, an orphaned intent. The UI's own /audit/status read
// must have LANDED before anything is judged — a test that ends before its read
// answers proves nothing — and the gateway is then asked directly for the
// answer to compare against.
import {expect, test} from '../../fixtures';
import {activeInstance, gw} from '../../helpers/api';

const STATUS_RE = /\/netlox\/v1\/audit\/status$/;

test.describe('@gw System page — audit REST signals (live)', () => {
	test('AUD-E2E-07: the section agrees with the gateway\'s /audit answer', async ({page}) => {
		const probe = await gw('GET', '/audit/status');
		test.skip(probe.status === 404, 'this gateway predates the audit API (/audit/status answered 404)');
		expect(probe.status, '/audit/status as the E2E admin').toBe(200);

		const instName = (await activeInstance()).name;
		await page.addInitScript(name => localStorage.setItem('system_audit_instance', JSON.stringify(name)), instName);
		const uiRead = page.waitForResponse(resp => STATUS_RE.test(new URL(resp.url()).pathname));
		await page.goto('system');
		expect((await uiRead).status(), 'the UI\'s own audit read').toBe(200);

		// The gateway's answer, read after the UI's so it is at least as fresh.
		const status = await (await gw('GET', '/audit/status')).json();
		const sinkResp = await gw('GET', '/audit/sink');
		const sink = sinkResp.ok ? await sinkResp.json() : undefined;

		const heading = page.getByRole('heading', {name: 'Gateway audit writer'});
		const section = heading.locator('xpath=ancestor::div[2]');
		await expect(section.getByText('Writer', {exact: true})).toBeVisible({timeout: 20_000});

		// Writer running (the metrics row) agrees with the REST writer state.
		const writer = section.getByText('Writer', {exact: true}).locator('xpath=following-sibling::*[1]');
		await expect(writer).toHaveText(status.running === true ? 'Running' : 'Not running');

		// The state of every sink is in the status list; a gateway older than
		// the list has only the compliance sink's own record to go by.
		const listed: {state?: string}[] | undefined = Array.isArray(status.sinks) ? status.sinks : status.sinks === null ? [] : undefined;
		const disconnected = listed ? listed.filter(s => s?.state === 'disconnected').length : sink?.enabled === true && sink?.connected !== true ? 1 : 0;
		await expect(section.getByText(/is configured but not connected/)).toHaveCount(disconnected);
		if (listed) {
			await expect(section.getByText(/is stalled: it cannot read its place/)).toHaveCount(listed.filter(s => s?.state === 'stalled').length);
			await expect(section.getByText(/is stopped and sends nothing/)).toHaveCount(listed.filter(s => s?.state === 'stopped').length);
		}
		// The read landed with 200, so the state is known.
		await expect(section.getByText(/sink state is unknown/)).toHaveCount(0);

		if ((status.orphaned_intents ?? 0) > 0 && status.last_orphan_event_id) {
			await expect(section.getByText(new RegExp(status.last_orphan_event_id))).toBeVisible();
		} else {
			await expect(section.getByText(/previous boot have no recorded result|most recent: event/i)).toHaveCount(0);
		}
		await expect(section.getByText(/administrator rights/)).toHaveCount(0);
	});
});
