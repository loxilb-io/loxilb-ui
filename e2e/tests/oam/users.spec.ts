//---------------------------------------------------------
// User management spec (docs/E2E_CRUD_TEST_PLAN.md §7).
// Drives the /user → "User List" (admin) tab: create (min + role),
// dup/weak validation, edit email (+F11 same-value regression),
// password change, delete, and the self-delete guard (F-USER-1).
//
// Throwaway accounts use the `e2euser` username prefix so the sweep
// removes them without ever touching the RBAC fixtures or admin.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {createUserApi, sweepTestUsers, TEST_USER_PREFIX} from '../../helpers/api';
import {Locator} from '@playwright/test';
import {confirmDelete, dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {isEventuallyDisabled} from '../../helpers/form';
import {grid, refreshUntilGone, refreshUntilRow, rowByText, selectRowByText, showAllRows, toolbarButton} from '../../helpers/table';

// The UserEditForm uses plain MUI TextFields whose required-asterisk renders
// with a thin space, so the shared `field` helper's exact `label *` regex
// misses them. These labels are unique by prefix, so anchor at the start and
// tolerate any trailing whitespace + optional asterisk.
function esc(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function f(page: Page, label: string): Locator {
	return dialog(page).getByLabel(new RegExp('^' + esc(label) + '\\s*\\*?$'));
}

const ADMIN_USER = process.env.E2E_ADMIN_USER!;
const GOOD_PW = 'Tz4#nQw8x'; // passes the server rules; distinct from the fixtures

let seq = 0;
function uniqUser(): string {
	return `${TEST_USER_PREFIX}${Date.now().toString().slice(-7)}${seq++}`;
}

const ROLE_OPTION: Record<string, string> = {
	viewer: 'Viewer (read-only)',
	operator: 'Operator',
	admin: 'Admin',
};

async function openUserList(page: Page): Promise<void> {
	await page.goto('user');
	await page.getByRole('tab', {name: 'User List'}).click();
	await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	await showAllRows(page);
}

interface NewUser {
	username: string;
	email: string;
	password: string;
	role?: 'viewer' | 'operator' | 'admin';
}

/** Drives the create modal; returns the POST /users request body. */
async function createUserViaUi(page: Page, u: NewUser): Promise<any> {
	const bodies: any[] = [];
	const cap = (r: any) => {
		if (r.method() === 'POST' && /\/users$/.test(r.url())) {
			try {
				bodies.push(JSON.parse(r.postData() || '{}'));
			} catch {
				/* ignore */
			}
		}
	};
	page.on('request', cap);
	try {
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('Create New User')).toBeVisible();
		await f(page, 'Username').fill(u.username);
		await f(page, 'Email').fill(u.email);
		await f(page, 'Password').fill(u.password);
		await f(page, 'Confirm Password').fill(u.password);
		if (u.role) await selectOption(page, 'Role', ROLE_OPTION[u.role]);
		await dialogButton(page, 'Create User').click();
		await expectSuccessAndDismiss(page);
	} finally {
		page.off('request', cap);
	}
	return bodies.at(-1);
}

test.describe('User management (admin User List tab)', () => {
	test.afterAll(async () => {
		await sweepTestUsers();
	});

	test.beforeEach(async ({page}) => {
		await openUserList(page);
	});

	test('C-min: create with default viewer role', async ({page}) => {
		const username = uniqUser();
		const body = await createUserViaUi(page, {username, email: `${username}@e2e.test`, password: GOOD_PW});
		expect(body?.role, 'new users default to least-privilege viewer').toBe('viewer');
		expect(body?.username).toBe(username);
		await refreshUntilRow(page, username);
		await expect(rowByText(page, username).getByText(/VIEWER/i)).toBeVisible();
	});

	test('C-role: create operator and admin', async ({page}) => {
		for (const role of ['operator', 'admin'] as const) {
			const username = uniqUser();
			const body = await createUserViaUi(page, {username, email: `${username}@e2e.test`, password: GOOD_PW, role});
			expect(body?.role).toBe(role);
			await refreshUntilRow(page, username);
			await expect(rowByText(page, username).getByText(new RegExp(role, 'i'))).toBeVisible();
		}
	});

	test('V-dup: duplicate username is rejected and surfaced in-modal', async ({page, consoleGuard}) => {
		consoleGuard.allow(/Failed to load resource/i);
		consoleGuard.allow(/status of 4\d\d/i);
		consoleGuard.allow(/User update failed/i);

		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('Create New User')).toBeVisible();
		await f(page, 'Username').fill(ADMIN_USER); // already exists
		await f(page, 'Email').fill('dup@e2e.test');
		await f(page, 'Password').fill(GOOD_PW);
		await f(page, 'Confirm Password').fill(GOOD_PW);
		await dialogButton(page, 'Create User').click();

		// Error surfaced inside the still-open modal; app stays healthy.
		await expect(dialog(page).getByRole('alert')).toBeVisible();
		await expect(dialog(page).getByText('Create New User')).toBeVisible();
		await dialogButton(page, 'Cancel').click();
	});

	test('V-weak: weak password keeps the Create button disabled', async ({page}) => {
		const username = uniqUser();
		await toolbarButton(page, 'Add').click();
		await expect(dialog(page).getByText('Create New User')).toBeVisible();
		await f(page, 'Username').fill(username);
		await f(page, 'Email').fill(`${username}@e2e.test`);
		await f(page, 'Password').fill('weak'); // < 9 chars, no upper/digit/special
		await f(page, 'Confirm Password').fill('weak');
		expect(await isEventuallyDisabled(dialogButton(page, 'Create User'))).toBe(true);
		await dialogButton(page, 'Cancel').click();
	});

	test('E-edit: change email, then re-submit unchanged (F11 same-value)', async ({page}) => {
		const username = uniqUser();
		await createUserApi({username, email: `${username}@e2e.test`, password: GOOD_PW, role: 'viewer'});
		await refreshUntilRow(page, username);

		const puts: any[] = [];
		const cap = (r: any) => {
			if (r.method() === 'PUT' && /\/users\/\d+$/.test(r.url())) {
				try {
					puts.push(JSON.parse(r.postData() || '{}'));
				} catch {
					/* ignore */
				}
			}
		};
		page.on('request', cap);
		try {
			// First edit — actually change the email.
			const newEmail = `${username}.edited@e2e.test`;
			await selectRowByText(page, username);
			await toolbarButton(page, 'Mode').click();
			await expect(dialog(page).getByText(/Edit User/)).toBeVisible();
			await f(page, 'Email').fill(newEmail);
			await dialogButton(page, 'Update User').click();
			await expectSuccessAndDismiss(page);
			expect(puts.at(-1)?.email).toBe(newEmail);
			await refreshUntilRow(page, newEmail);

			// Second edit — submit with the SAME value. F11: the server used to
			// 500 on a no-op PUT; it must now succeed.
			await selectRowByText(page, username);
			await toolbarButton(page, 'Mode').click();
			await expect(dialog(page).getByText(/Edit User/)).toBeVisible();
			await dialogButton(page, 'Update User').click();
			await expectSuccessAndDismiss(page);
			expect(puts.at(-1)?.email, 'no-op PUT carries the unchanged email').toBe(newEmail);
		} finally {
			page.off('request', cap);
		}
	});

	test('E-password: change an existing user password', async ({page}) => {
		const username = uniqUser();
		await createUserApi({username, email: `${username}@e2e.test`, password: GOOD_PW, role: 'viewer'});
		await refreshUntilRow(page, username);

		const puts: any[] = [];
		const cap = (r: any) => {
			if (r.method() === 'PUT' && /\/users\/\d+$/.test(r.url())) {
				try {
					puts.push(JSON.parse(r.postData() || '{}'));
				} catch {
					/* ignore */
				}
			}
		};
		page.on('request', cap);
		try {
			await selectRowByText(page, username);
			await toolbarButton(page, 'Mode').click();
			await expect(dialog(page).getByText(/Edit User/)).toBeVisible();
			await dialogButton(page, 'Change Password').click();
			await f(page, 'New Password').fill('Wm9$kZt4p');
			await f(page, 'Confirm New Password').fill('Wm9$kZt4p');
			await dialogButton(page, 'Update User').click();
			await expectSuccessAndDismiss(page);
			expect(puts.at(-1)?.password, 'password included in the update payload').toBe('Wm9$kZt4p');
		} finally {
			page.off('request', cap);
		}
	});

	test('D-single: delete a user', async ({page}) => {
		const username = uniqUser();
		await createUserApi({username, email: `${username}@e2e.test`, password: GOOD_PW, role: 'viewer'});
		await refreshUntilRow(page, username);

		await selectRowByText(page, username);
		await toolbarButton(page, 'Delete').click();
		await confirmDelete(page); // DataTable's "WARNING!! Delete Item" confirm
		await refreshUntilGone(page, username);
	});

	test('D-self blocked: admin cannot delete their own account (F-USER-1)', async ({page}) => {
		// Match the admin row by its EXACT username cell — a substring match on
		// "admin" would also hit any row whose role cell reads "🛡️ ADMIN".
		const adminRow = grid(page).locator('.MuiDataGrid-row').filter({has: page.getByText(new RegExp('^' + esc(ADMIN_USER) + '$'))});
		await refreshUntilRow(page, ADMIN_USER);
		await expect(adminRow).toHaveCount(1);
		await adminRow.getByRole('checkbox').check();
		await toolbarButton(page, 'Delete').click();
		await confirmDelete(page); // pass the generic warning…
		// …then the self-delete guard blocks it (F-USER-1).
		await expect(dialogTitle(page, 'Cannot Delete')).toBeVisible();
		await dialogButton(page, 'OK').click();
		// Admin was NOT deleted.
		await expect(adminRow).toHaveCount(1);
	});
});
