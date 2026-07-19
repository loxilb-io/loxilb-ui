//---------------------------------------------------------
// Profile spec (docs/E2E_CRUD_TEST_PLAN.md §7). A self email edit must
// persist everywhere — the Profile tab AND the header profile menu —
// immediately (no reload) and across a reload. This is the stale-menu-cache
// regression: the app renders identity from the `my_info` query, which a
// self-edit must invalidate (F-PROFILE-1).
//
// Read-modify-restore: the admin's real email is put back in `finally`.
//---------------------------------------------------------
import {Locator, Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {getMe, updateUserApi} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';

// The UserEditForm's required asterisk renders with a thin space; anchor at the
// start and tolerate trailing whitespace/asterisk (see users.spec.ts).
function emailField(page: Page): Locator {
	return dialog(page).getByLabel(/^Email\s*\*?$/);
}

test('self email edit persists in the Profile tab and header menu (F-PROFILE-1)', async ({page}) => {
	const me = await getMe();
	const newEmail = `e2e-profile-${Date.now().toString().slice(-7)}@e2e.test`;

	try {
		await page.goto('user');
		await expect(page.getByText('Profile Information')).toBeVisible({timeout: 20_000});
		// Wait for my_info to actually load — "Edit Profile" is a no-op until it
		// does (handleEditProfile guards on my_info), so click only once the real
		// email has rendered on the panel.
		await expect(page.getByText(me.email, {exact: true})).toBeVisible({timeout: 20_000});

		await page.getByRole('button', {name: 'Edit Profile'}).click();
		await expect(dialog(page).getByText(/Edit User/)).toBeVisible();
		await emailField(page).fill(newEmail);
		await dialogButton(page, 'Update User').click();
		await expectSuccessAndDismiss(page);

		// Immediate — no reload: the Profile tab reflects the new email…
		await expect(page.getByText(newEmail)).toBeVisible({timeout: 10_000});
		// …and so does the header profile menu (the stale-cache guard).
		await page.locator('#profile').click();
		await expect(page.locator('.MuiMenu-root').getByText(newEmail)).toBeVisible();
		await page.keyboard.press('Escape');

		// And it survives a full reload (fresh /users/me).
		await page.reload();
		await expect(page.getByText('Profile Information')).toBeVisible({timeout: 20_000});
		await expect(page.getByText(newEmail)).toBeVisible();
	} finally {
		// Restore the admin's real email so the run is idempotent.
		await updateUserApi(me.id, {username: me.username, email: me.email});
	}
});
