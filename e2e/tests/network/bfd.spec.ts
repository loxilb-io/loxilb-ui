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
import {activeInstance, BFD_NONE_RUNNING_500} from '../../helpers/api';
import {toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('BFD page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		// Wait for the list read to answer: a test that finishes before it lands
		// lets a failed read through unseen.
		const read = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/config/bfd/all'));
		await page.goto(`instance/network/bfd?name=${instName}`); // relative — see baseURL note
		await read;
	});

	test('renders the BFD page cleanly (toolbar present, no crash)', async ({page, consoleGuard}) => {
		// With no BFD session running, GET /config/bfd/all answers 500 instead of
		// an empty list — a gateway defect (see BFD_NONE_RUNNING_500); exactly
		// that is allowed.
		consoleGuard.allowRequest(BFD_NONE_RUNNING_500);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible();
	});

	// Gateway 404 "cluster instance not found" — no cluster on this testbed.
	test.skip('C-full: instance/remoteIp/sourceIp/interval/retry create then D', async () => {});
});
