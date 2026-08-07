//---------------------------------------------------------
// BFD page spec.
//
// On this single-node testbed POST /config/bfd returns 404 "cluster instance
// not found" — BFD sessions require a cluster instance that is not configured
// here (loxilb runs standalone). Create/delete therefore cannot be exercised;
// they are skipped (matching the AI-group auto-skip decision). We smoke-test
// that the page renders cleanly.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('BFD page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/bfd?name=${instName}`); // relative — see baseURL note
	});

	test('renders the BFD page cleanly (toolbar present, no crash)', async ({page, consoleGuard}) => {
		// GET /config/bfd/all returns 500 on this single-node testbed — BFD state
		// lives on a cluster instance that isn't configured here (loxilb runs
		// standalone). The UI degrades gracefully (error banner via isError), so
		// allow the gateway-side 5xx pass-through rather than fail the smoke test.
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 500/);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible();
	});

	// Gateway 404 "cluster instance not found" — no cluster on this testbed.
	test.skip('C-full: instance/remoteIp/sourceIp/interval/retry create then D', async () => {});
});
