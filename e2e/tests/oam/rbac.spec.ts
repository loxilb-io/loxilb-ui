//---------------------------------------------------------
// RBAC spec (docs/E2E_CRUD_TEST_PLAN.md §7). Three storageState
// sessions provisioned by auth.setup.ts:
//   • viewer   — read-only everywhere: no add/edit/delete controls and
//                zero mutation requests across every mutable Group-1..6 route
//   • operator — gateway writes allowed, but no user admin
//   • admin    — everything visible
//
// The UI guards are UX-only (DataTable hides mutation icons for is_viewer,
// can_write_gateway gates custom write buttons); the OAM server is the
// real boundary.
//---------------------------------------------------------
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
	'security/securityrate',
];

const MUTATION_ICONS = ['AddIcon', 'ModeIcon', 'DeleteIcon'];

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

	// Instance CRUD is admin-only (OAM ActInstanceWrite): a viewer sees the
	// instance cards but none of the controls that would 403.
	test('viewer: instances page offers no add/modify/delete', async ({page}) => {
		await page.goto('instance');
		await expect(page.locator('.MuiCard-root').filter({hasText: instName})).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiCard-root').filter({hasText: 'Add New Instance'})).toHaveCount(0);
		await expect(page.locator('button:has([data-testid="SettingsIcon"])')).toHaveCount(0);
		await expect(page.locator('button:has([data-testid="DeleteForeverIcon"])')).toHaveCount(0);
	});
});

test.describe('RBAC — operator', () => {
	test.use({storageState: '.auth/operator.json'});

	test('operator: gateway writes allowed (LB Add control visible)', async ({page}) => {
		await page.goto(`instance/traffic/lb?name=${instName}`);
		await expect(page.locator('button:has([data-testid="AddIcon"])').first()).toBeVisible({timeout: 20_000});
	});

	// Instance writes are admin-only, so an operator gets the same read-only
	// instances page a viewer does — despite holding gateway write rights.
	test('operator: instances page offers no add/modify/delete', async ({page}) => {
		await page.goto('instance');
		await expect(page.locator('.MuiCard-root').filter({hasText: instName})).toBeVisible({timeout: 20_000});
		await expect(page.locator('.MuiCard-root').filter({hasText: 'Add New Instance'})).toHaveCount(0);
		await expect(page.locator('button:has([data-testid="SettingsIcon"])')).toHaveCount(0);
	});

	test('operator: not a user admin (no User List tab)', async ({page}) => {
		await page.goto('user');
		await expect(page.getByRole('tab', {name: 'Profile'})).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('tab', {name: 'User List'})).toHaveCount(0);
	});

});

test.describe('RBAC — admin', () => {
	test.use({storageState: '.auth/admin.json'});

	// Legacy config-management was removed (docs/SNAPSHOT_UI_DESIGN.md §2, U-0);
	// even admin gets no entry point and a 404 on the old route.
	test('admin: legacy config-management surface is gone (no icon, route 404s)', async ({page}) => {
		await page.goto('instance/traffic/lb?name=' + instName);
		await expect(page.locator('#header')).toBeVisible({timeout: 20_000});
		await expect(page.locator('#header a[href$="/config-management"]')).toHaveCount(0);
		await page.goto('config-management');
		await expect(page.getByText('Page not found')).toBeVisible({timeout: 20_000});
	});

	test('admin: User List tab present with mutation controls', async ({page}) => {
		await page.goto('user');
		await page.getByRole('tab', {name: 'User List'}).click();
		await expect(page.locator('button:has([data-testid="AddIcon"])').first()).toBeVisible({timeout: 20_000});
	});

	test('admin: instances page exposes add/modify/delete', async ({page}) => {
		await page.goto('instance');
		await expect(page.locator('.MuiCard-root').filter({hasText: 'Add New Instance'})).toBeVisible({timeout: 20_000});
		await expect(page.locator('button:has([data-testid="SettingsIcon"])').first()).toBeVisible();
		await expect(page.locator('button:has([data-testid="DeleteForeverIcon"])').first()).toBeVisible();
	});
});
