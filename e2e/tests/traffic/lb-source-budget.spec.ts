//---------------------------------------------------------
// LB create form — source-check slot budget against the live gateway (SRC-E2E-06).
//---------------------------------------------------------
// The caption must equal what the gateway says, read at the same moment — never
// local arithmetic. Then a rule carrying a source is created through the UI, and
// the reopened form must show the gateway's NEW answer (the budget is re-asked
// after every LB write).
import type {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gwJson, sweepFirewallRules, sweepLbRules} from '../../helpers/api';
import {dialogButton, expectSuccessAndDismiss, openToolbarDialog} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';

const CAPS_RE = /\/netlox\/v1\/status\/capabilities(\?.*)?$/;
const NAME = 'e2e-src-budget';

type Budget = {ready: boolean; limit?: number; in_use?: number};

async function gatewayBudget(): Promise<Budget | undefined> {
	const body = await gwJson<{capabilities?: (Budget & {name: string})[]}>('/status/capabilities');
	return body.capabilities?.find(c => c.name === 'lb_allowed_sources');
}

/** Open Add and return the Allowed Sources section. */
async function openAdd(page: Page) {
	await openToolbarDialog(page, 'Add', 'Add Load Balancer Rule');
	return expandSection(page, /^Allowed Sources$/);
}

test.describe('@gw LB source-check slot budget (live)', () => {
	test.beforeAll(async () => {
		await sweepLbRules();
		await sweepFirewallRules();
	});
	test.afterAll(async () => {
		await sweepLbRules();
		await sweepFirewallRules();
	});

	test('SRC-E2E-06: the caption equals the gateway\'s budget, before and after a create', async ({page}) => {
		const before = await gatewayBudget();
		test.skip(!before, 'this gateway does not report lb_allowed_sources');
		test.skip(!before!.ready || before!.limit === undefined || before!.in_use === undefined, 'the testbed has no free source-check slot, or reports no budget');

		const instName = (await activeInstance()).name;
		// Every capability read and LB create the page makes, in the order they answered.
		const answered: string[] = [];
		page.on('response', resp => {
			const path = new URL(resp.url()).pathname;
			if (CAPS_RE.test(path)) answered.push('caps');
			else if (resp.request().method() === 'POST' && path.endsWith('/config/loadbalancer')) answered.push('create');
		});
		await page.goto(`instance/traffic/lb?name=${instName}`);
		let sources = await openAdd(page);
		// The form's own read must have landed before the caption is judged.
		await expect.poll(() => answered.includes('caps')).toBe(true);
		const now = (await gatewayBudget())!;
		await expect(sources.getByText(`${now.limit! - now.in_use!} of ${now.limit} source-check slots free`)).toBeVisible();

		await field(page, 'Rule Name').fill(NAME);
		await expandSection(page, /^Basic Settings/);
		await field(page, 'External IP').fill('203.0.113.121');
		await field(page, 'Port Min').fill('2121');
		const eps = await expandSection(page, /^Endpoints$/);
		await eps.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP', eps).first().fill('198.51.100.121');
		await field(page, 'Target Port', eps).first().fill('8080');
		await sources.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP Address', sources).first().fill('198.51.100.0/26');
		await dialogButton(page, 'Create').click();
		await expectSuccessAndDismiss(page);

		// The budget was re-asked AFTER the create answered (the invalidation).
		// Without it the reopened form would reuse the pre-create read.
		await expect.poll(() => answered.slice(answered.indexOf('create') + 1).includes('caps')).toBe(true);
		sources = await openAdd(page);
		const after = (await gatewayBudget())!;
		// The rule took a slot; the form shows the gateway's new answer.
		expect(after.in_use).toBe(now.in_use! + 1);
		await expect(sources.getByText(`${after.limit! - after.in_use!} of ${after.limit} source-check slots free`)).toBeVisible();
		await dialogButton(page, 'Cancel').click();
	});
});
