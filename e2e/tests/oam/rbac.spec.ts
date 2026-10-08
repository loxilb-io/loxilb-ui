//---------------------------------------------------------
// RBAC spec. Three storageState
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
import {activeInstance, AIManagementReadiness, aiNotReadyAllowance, BFD_NONE_RUNNING_500, BGP_DISABLED, gatewayAIManagementReadiness, RATELIMIT_DEFAULTS_ABSENT} from '../../helpers/api';

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
	let readiness: AIManagementReadiness;
	test.beforeAll(async () => {
		readiness = await gatewayAIManagementReadiness();
	});

	test.use({storageState: '.auth/viewer.json'});

	for (const route of MUTABLE_ROUTES) {
		test(`viewer: ${route} exposes no mutation controls or requests`, async ({page, consoleGuard}) => {
			// Only the reads these routes are KNOWN to fail, each for its reason:
			// the defaults ladder's "no row", BFD with no session running (a
			// gateway defect), BGP disabled, and an unready AI management API.
			// Anything else a viewer's read hits is a finding.
			for (const a of [RATELIMIT_DEFAULTS_ABSENT, BFD_NONE_RUNNING_500, BGP_DISABLED]) consoleGuard.allowRequest(a);
			const notReady = aiNotReadyAllowance(readiness);
			if (notReady) consoleGuard.allowRequest(notReady);

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

// The management backend serves an instance's process log and its archives to
// operators and administrators only. A viewer is not offered the page, is told
// why on a direct visit, and sends neither read from the page or the dashboard.
test.describe('RBAC — viewer and instance logs', () => {
	test.use({storageState: '.auth/viewer.json'});

	function trackLogReads(page: import('@playwright/test').Page): string[] {
		const urls: string[] = [];
		page.on('request', r => {
			if (/\/netlox\/v1\/(logs|log-archives)(\?|\/|$)/.test(r.url())) urls.push(r.url());
		});
		return urls;
	}

	test('viewer: the Logs page says it is not available to the role and reads nothing', async ({page}) => {
		const reads = trackLogReads(page);
		await page.goto(`instance/status/logs?name=${instName}`);
		await expect(page.getByTestId('role-denied')).toBeVisible({timeout: 20_000});
		await expect(page.getByRole('heading', {name: 'Instance Logs'})).toHaveCount(0);
		// The menu is rendered from the same role: no Logs entry to click.
		await expect(page.getByRole('link', {name: 'Logs', exact: true})).toHaveCount(0);
		await expect(page.getByRole('button', {name: 'Logs', exact: true})).toHaveCount(0);
		expect(reads, 'a viewer must not send log reads the backend refuses').toEqual([]);
	});

	test('viewer: the dashboard log card says who can read logs and reads nothing', async ({page}) => {
		const reads = trackLogReads(page);
		await page.goto(`instance/dashboard?name=${instName}`);
		await expect(page.getByTestId('system-log-not-permitted')).toBeVisible({timeout: 30_000});
		expect(reads, 'a viewer must not send log reads the backend refuses').toEqual([]);
	});
});

test.describe('RBAC — operator', () => {
	test.use({storageState: '.auth/operator.json'});

	test('operator: the Logs page is offered and reads the log', async ({page}) => {
		const logRead = page.waitForResponse(r => /\/netlox\/v1\/logs(\?|$)/.test(r.url()) && r.request().method() === 'GET', {timeout: 30_000});
		await page.goto(`instance/status/logs?name=${instName}`);
		await expect(page.getByRole('heading', {name: 'Instance Logs'})).toBeVisible({timeout: 20_000});
		await expect(page.getByTestId('role-denied')).toHaveCount(0);
		expect((await logRead).status()).toBe(200);
	});

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
