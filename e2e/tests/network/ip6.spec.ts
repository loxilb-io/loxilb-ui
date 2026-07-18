//---------------------------------------------------------
// IPv6 address page spec (docs/E2E_CRUD_TEST_PLAN.md §5).
// Same IPPage component with family=ipv6.
//
// GW-5 (gateway bug, OPEN): POST /config/ipv6address returns 200 but
// GET /config/ipv6address/all always returns an empty ipAttr[] — created IPv6
// addresses are never listed. The IPv6 page therefore shows no rows, and since
// this page's create path is "edit an existing row" (there is no Add button),
// the UI create/delete flow has no row to operate on. Those cases are skipped
// until the gateway lists IPv6 addresses; the IPv4 spec covers the shared
// component logic. We still smoke-test that the page renders cleanly.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {toolbarButton} from '../../helpers/table';

let instName: string;

test.describe('IPv6 address page', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/network/ip6?name=${instName}`); // relative — see baseURL note
	});

	test('renders the IPv6 page cleanly (toolbar present, no crash)', async ({page}) => {
		await expect(toolbarButton(page, 'Refresh')).toBeVisible({timeout: 20_000});
		// The DataGrid mounts even with zero rows.
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible();
		// consoleGuard (auto) asserts no uncaught errors + no error-page redirect.
	});

	// GW-5: gateway does not list IPv6 addresses, so there is no row to edit
	// (create) or delete through the UI. Re-enable once GET returns them.
	test.skip('E-update-create: editing the base row POSTs {dev, ::30}, then D', async () => {});
	test.skip('V-cidr: a bare IPv6 (no mask) blocks Update', async () => {});
});
