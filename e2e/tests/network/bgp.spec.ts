//---------------------------------------------------------
// BGP pages spec (docs/E2E_CRUD_TEST_PLAN.md §5).
//
// loxilb runs with BGP mode DISABLED on this testbed — every BGP data call
// (neigh / definedsets / policy / apply / global) returns 403 "loxilb BGP mode
// is disabled". CRUD (neighbor, defined-set, policy, apply, global config)
// therefore cannot be exercised and is skipped. What we CAN and DO verify:
// every BGP page renders and degrades gracefully on the 403 — it must not
// crash the app or redirect to an error page (no-redirect guard). This is exactly the
// routing-safety posture the plan asks for on global/apply (never mutate).
//---------------------------------------------------------
import {ConsoleGuard, expect, test} from '../../fixtures';
import {Page} from '@playwright/test';
import {activeInstance} from '../../helpers/api';

// The disabled-BGP 403 (and its failed-fetch console line) are expected here.
function allowBgpDisabled(guard: ConsoleGuard): void {
	guard.allow(/Failed to load resource/i);
	guard.allow(/BGP mode is disabled/i);
	guard.allow(/Capacity insufficient/i);
	guard.allow(/403/);
}

let instName: string;

test.describe('BGP pages (render + graceful 403; BGP mode disabled on testbed)', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	async function smoke(page: Page, guard: ConsoleGuard, path: string, anchor: () => Promise<void>): Promise<void> {
		allowBgpDisabled(guard);
		await page.goto(`instance/network/bgp/${path}?name=${instName}`); // relative — see baseURL note
		await anchor();
		// consoleGuard (auto) enforces: no unexpected console errors + no error-page redirect.
	}

	test('neighbor page renders (table present)', async ({page, consoleGuard}) => {
		await smoke(page, consoleGuard, 'neighbor', async () => {
			await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible({timeout: 20_000});
		});
	});

	test('defined-set page renders (table present)', async ({page, consoleGuard}) => {
		await smoke(page, consoleGuard, 'set', async () => {
			await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible({timeout: 20_000});
		});
	});

	test('policy definition page renders (table present)', async ({page, consoleGuard}) => {
		await smoke(page, consoleGuard, 'def', async () => {
			await expect(page.locator('.MuiDataGrid-root').first()).toBeVisible({timeout: 20_000});
		});
	});

	test('apply page renders (form present)', async ({page, consoleGuard}) => {
		await smoke(page, consoleGuard, 'apply', async () => {
			await expect(page.getByText('Apply BGP Policy to Neighbor')).toBeVisible({timeout: 20_000});
		});
	});

	test('global config page renders (form present)', async ({page, consoleGuard}) => {
		await smoke(page, consoleGuard, 'global', async () => {
			await expect(page.getByText('BGP Global Configuration')).toBeVisible({timeout: 20_000});
		});
	});

	// BGP mode disabled → all mutations 403. Re-enable once the testbed runs
	// loxilb with BGP enabled.
	test.skip('neighbor C {ipAddress,remoteAs,remotePort,setMultiHop} + D', async () => {});
	test.skip('defined-set C/D + policy definition C/D', async () => {});
	test.skip('global/apply read-modify-restore (routing-safe)', async () => {});
});
