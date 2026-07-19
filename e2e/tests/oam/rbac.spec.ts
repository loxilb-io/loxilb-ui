//---------------------------------------------------------
// RBAC spec (docs/E2E_CRUD_TEST_PLAN.md §7). Three storageState
// sessions provisioned by auth.setup.ts:
//   • viewer   — read-only everywhere: no add/edit/delete controls and
//                zero mutation requests across every mutable Group-1..6 route
//   • operator — gateway writes allowed, but no user admin / no config mgmt
//   • admin    — everything visible
//
// The UI guards are UX-only (DataTable hides mutation icons for is_viewer,
// can_write_gateway gates custom write buttons, RequireAdminRoute + the
// header gate config-management); the OAM server is the real boundary.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';

let instName: string;
test.beforeAll(async () => {
	instName = (await activeInstance()).name;
});

// Every mutable page across Groups 1–6 (status dashboards are read-only by
// construction and carry no toolbar).
const MUTABLE_ROUTES = [
	'network/ip',
	'network/ip6',
	'network/port',
	'network/neighbor',
	'network/route',
	'network/vlan',
	'network/vxlan',
	'network/fdb',
	'network/bfd',
	'traffic/endpoint',
	'traffic/fw',
	'traffic/lb',
	'traffic/mirror',
	'traffic/qos',
	'traffic/sni-certs',
	'ai/apikey',
	'ai/ratelimit',
	'ipsec/tunnels',
	'ipsec/certs',
	'security/ipfilter',
	'security/synflood',
	'security/securityrate',
];

const MUTATION_ICONS = ['AddIcon', 'ModeIcon', 'DeleteIcon'];

function configLink(page: Page) {
	return page.locator('#header a[href$="/config-management"]');
}

test.describe('RBAC — viewer (read-only everywhere)', () => {
	test.use({storageState: '.auth/viewer.json'});

	for (const route of MUTABLE_ROUTES) {
		test(`viewer: ${route} exposes no mutation controls or requests`, async ({page, consoleGuard}) => {
			// Some read endpoints answer 4xx/5xx for a viewer or an un-built feature
			// (AI 501); Chrome logs those. We only care about controls + mutations here.
			consoleGuard.allow(/Failed to load resource/i);
			consoleGuard.allow(/status of \d{3}/i);

			const mutations: string[] = [];
			const cap = (r: any) => {
				const m = r.method();
				if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(m) && !/\/(login|logout)\b/.test(r.url())) {
					mutations.push(`${m} ${r.url()}`);
				}
			};
			page.on('request', cap);
			try {
				await page.goto(`instance/${route}?name=${instName}`);
				await page.waitForLoadState('domcontentloaded');
				// Give the page time to render its toolbar and fire any read queries.
				await page.waitForTimeout(2000);

				for (const icon of MUTATION_ICONS) {
					await expect(page.locator(`button:has([data-testid="${icon}"])`), `${route}: ${icon} must be hidden for viewer`).toHaveCount(0);
				}
			} finally {
				page.off('request', cap);
			}
			expect(mutations, `viewer triggered mutation requests on ${route}`).toEqual([]);
		});
	}

	test('viewer: /user shows Profile only (no User List tab)', async ({page}) => {
		await page.goto('user');
		await expect(page.getByRole('tab', {name: 'Profile'})).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('tab', {name: 'User List'})).toHaveCount(0);
	});

	test('viewer: no Config Management entry point; the route is blocked', async ({page}) => {
		await page.goto('instance/traffic/lb?name=' + instName);
		await expect(configLink(page)).toHaveCount(0);
		await page.goto('config-management');
		await expect(page).toHaveURL(/\/instance/, {timeout: 20_000});
		await expect(page).not.toHaveURL(/config-management/);
	});
});

test.describe('RBAC — operator', () => {
	test.use({storageState: '.auth/operator.json'});

	test('operator: gateway writes allowed (LB Add control visible)', async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await expect(page.locator('button:has([data-testid="AddIcon"])').first()).toBeVisible({timeout: 20_000});
	});

	test('operator: not a user admin (no User List tab)', async ({page}) => {
		await page.goto('user');
		await expect(page.getByRole('tab', {name: 'Profile'})).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('tab', {name: 'User List'})).toHaveCount(0);
	});

	test('operator: no Config Management entry point; the route is blocked', async ({page}) => {
		await page.goto('instance/traffic/lb?name=' + instName);
		await expect(configLink(page)).toHaveCount(0);
		await page.goto('config-management');
		await expect(page).toHaveURL(/\/instance/, {timeout: 20_000});
		await expect(page).not.toHaveURL(/config-management/);
	});
});

test.describe('RBAC — admin', () => {
	test.use({storageState: '.auth/admin.json'});

	test('admin: Config Management entry point + route reachable', async ({page}) => {
		await page.goto('instance/traffic/lb?name=' + instName);
		await expect(configLink(page)).toHaveCount(1);
		await page.goto('config-management');
		await expect(page).toHaveURL(/config-management/, {timeout: 20_000});
		await expect(page.getByRole('tab', {name: 'Export'})).toBeVisible();
	});

	test('admin: User List tab present with mutation controls', async ({page}) => {
		await page.goto('user');
		await page.getByRole('tab', {name: 'User List'}).click();
		await expect(page.locator('button:has([data-testid="AddIcon"])').first()).toBeVisible({timeout: 20_000});
	});
});
