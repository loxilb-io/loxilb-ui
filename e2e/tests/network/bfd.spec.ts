//---------------------------------------------------------
// BFD page spec.
//
// An initialized gateway without keepalive sessions must return a successful
// list, not a 500. Reads must not implicitly start BFD/HA. Live mutation of
// BFD sessions belongs in an isolated namespace so the shared testbed's HA
// state cannot be changed by this page smoke test.
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
		// Wait for the list read to answer: a test that finishes before it lands
		// lets a failed read through unseen.
		const read = page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/config/bfd/all'));
		await page.goto(`instance/network/bfd?name=${instName}`); // relative — see baseURL note
		const response = await read;
		expect(response.status(), 'initialized BFD list is readable even with no sessions').toBe(200);
		const payload = await response.json();
		expect(Array.isArray(payload.Attr), 'BFD lists always carry an array').toBe(true);
	});

	test('renders the BFD page cleanly (toolbar present, no crash)', async ({page}) => {
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible();
	});

	// Session creation changes HA state; run its lifecycle in a dedicated namespace.
	test.skip('C-full: instance/remoteIp/sourceIp/interval/retry create then D', async () => {});
});
