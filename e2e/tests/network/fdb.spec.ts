//---------------------------------------------------------
// FDB (forwarding database) page spec (docs/E2E_CRUD_TEST_PLAN.md §5).
//
// GW-6 (gateway bug, OPEN): POST /config/fdb returns 200 but
// GET /config/fdb/all always returns an empty fdbAttr[] on this testbed
// (tried eth0, llb0, docker0; a real bridge port 404s). Created FDB entries
// are never listed, so the page shows no rows and its select→delete flow has
// nothing to operate on. Create/delete are skipped until the gateway lists
// FDB entries; we still smoke-test that the page renders cleanly.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('FDB page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/fdb?name=${instName}`); // relative — see baseURL note
	});

	test('renders the FDB page cleanly (toolbar present, no crash)', async ({page}) => {
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible();
	});

	// GW-6: gateway does not list FDB entries, so a created entry never
	// appears and cannot be selected for deletion. Re-enable once GET returns.
	test.skip('C-min: dev + mac create then D', async () => {});
});
