// UC-8 local browser checks: real priority component, no OAM/Gateway.
import {test, expect} from '../fixtures';

test.beforeEach(async ({context}) => {
	await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4179'
		? route.continue() : route.abort('blockedbyclient'));
});

for (const [scope, unset] of [
	['key', 'Unset (no cap from this key)'],
	['tenant', 'Unset (held at standard)'],
	['jwt', 'Unset (no cap from this profile)'],
] as const) {
	test(`UC8-LOCAL-01 ${scope}: unset semantics and omitted create fields`, async ({page}) => {
		await page.goto(`/e2e/local/uc8-priority/?scope=${scope}`);
		await expect(page.getByRole('combobox', {name: 'Priority Class'})).toHaveCount(0);
		await page.getByRole('button', {name: 'Request Priority'}).click();
		await expect(page.getByRole('combobox', {name: 'Priority Class'})).toHaveText(unset);
		await expect(page.getByTestId('create-body')).toHaveText('{}');
		if (scope === 'jwt') await expect(page.getByText('Default Objective', {exact: true})).toHaveCount(0);
	});
}

test('UC8-LOCAL-02 key edit: untouched fields omitted, changed class and explicit clear retained', async ({page}) => {
	await page.goto('/e2e/local/uc8-priority/?scope=key&edit');
	await expect(page.getByTestId('change-body')).toHaveText('{}');
	await page.getByRole('combobox', {name: 'Priority Class'}).click();
	await page.getByRole('option', {name: 'sheddable', exact: true}).click();
	await expect(page.getByTestId('change-body')).toHaveText('{"priority_class":"sheddable"}');
	// The existing field renderer associates each input with its label.
	await page.getByLabel('Default Objective', {exact: true}).clear();
	await expect(page.getByTestId('change-body')).toHaveText('{"priority_class":"sheddable","default_objective":""}');
});

test('UC8-LOCAL-03 tenant edit: clearing allowance is an explicit empty array', async ({page}) => {
	await page.goto('/e2e/local/uc8-priority/?scope=tenant&edit');
	await expect(page.getByTestId('change-body')).toHaveText('{}');
	await page.getByLabel('Allowed Objectives (comma-separated)', {exact: true}).clear();
	await expect(page.getByTestId('change-body')).toHaveText('{"allowed_objectives":[]}');
});

test('UC8-LOCAL-04 unknown objective warns while retaining the requested value', async ({page}) => {
	await page.goto('/e2e/local/uc8-priority/?scope=key');
	await page.getByRole('button', {name: 'Request Priority'}).click();
	await page.getByLabel('Default Objective', {exact: true}).fill('missing');
	await expect(page.getByRole('alert')).toContainText('names no objective that exists now');
	await expect(page.getByTestId('create-body')).toHaveText('{"default_objective":"missing"}');
});
