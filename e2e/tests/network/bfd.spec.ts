//---------------------------------------------------------
// BFD page spec (docs/E2E_CRUD_TEST_PLAN.md §5).
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

	test('renders the BFD page cleanly (toolbar present, no crash)', async ({page}) => {
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible();
	});

	// Gateway 404 "cluster instance not found" — no cluster on this testbed.
	test.skip('C-full: instance/remoteIp/sourceIp/interval/retry create then D', async () => {});
});
