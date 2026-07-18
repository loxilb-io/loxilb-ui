//---------------------------------------------------------
// QoS policy page CRUD spec (docs/E2E_CRUD_TEST_PLAN.md §1.5).
// POST /config/policy, DELETE /config/policy/ident/{ident}; payload
// IPolicyAttribute {policyIdent, policyInfo, targetObject}.
//
// Safety: every policy attaches to a live Port with inert-high policer
// rates (1 Gbps / 2 Gbps) — a policer above real management traffic is
// non-disruptive — and is deleted immediately. QoSTable is a hideCheckbox
// table: rows are selected by click (single-select only; there is no bulk
// delete affordance, so no D-multi case).
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance, gw, sweepQosPolicies} from '../../helpers/api';
import {confirmDelete, dialog, dialogButton, dialogTitle, expectSuccessAndDismiss, selectOption} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {refreshUntilGone, refreshUntilRow, selectRowByClick, showAllRows, toolbarButton} from '../../helpers/table';

const QOS_PATH = '/config/policy';

const CIR = '1000000000'; // 1 Gbps committed — inert vs real traffic
const PIR = '2000000000'; // 2 Gbps peak

async function openAddDialog(page: Page): Promise<void> {
	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('New Policy')).toBeVisible();
	await expect(field(page, 'Policy Identifier')).toBeVisible();
}

/** Selects Port attachment (always available) so no live LB rule is touched. */
async function attachToPort(page: Page): Promise<void> {
	await selectOption(page, 'Attachment Type', 'Port');
	// The Attached Port dropdown auto-selects the first port on switch.
	await expect(field(page, 'Attached Port')).toBeVisible();
}

async function submitAdd(page: Page): Promise<any> {
	await page.mouse.move(0, 0); // dismiss any sticky ParamBox tooltip
	const [req] = await Promise.all([
		page.waitForRequest(r => r.method() === 'POST' && r.url().includes(QOS_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	return req;
}

async function captureDeletes(page: Page, action: () => Promise<void>): Promise<URL[]> {
	const urls: URL[] = [];
	const listener = (r: any) => {
		if (r.method() === 'DELETE' && r.url().includes(`${QOS_PATH}/ident`)) urls.push(new URL(r.url()));
	};
	page.on('request', listener);
	try {
		await action();
	} finally {
		page.off('request', listener);
	}
	return urls;
}

let instName: string;

test.describe('QoS policy page CRUD', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepQosPolicies();
	});

	test.afterEach(async () => {
		await sweepQosPolicies();
	});

	test.beforeEach(async ({page}) => {
		await page.goto(`instance/traffic/qos?name=${instName}`); // relative — see baseURL note
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);
	});

	test('C-min: required ident + rates, TrTCM default, Port attachment; no client keys; D-single', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Policy Identifier').fill('e2e-qos-min');
		await field(page, 'Committed Info Rate(bps)').fill(CIR);
		await field(page, 'Peak Info Rate(bps)').fill(PIR);
		await attachToPort(page);

		const req = await submitAdd(page);
		const body = req.postDataJSON();

		expect(body.policyIdent).toBe('e2e-qos-min');
		// type:0 (TrTCM) is the displayed dropdown default — it must be POSTed,
		// not dropped (F19-sibling regression in the QoS policyInfo subform).
		expect(body.policyInfo).toMatchObject({type: 0, committedInfoRate: 1000000000, peakInfoRate: 2000000000});
		expect(body.targetObject.attachment).toBe(1);
		expect(typeof body.targetObject.polObjName, 'a real port name is attached').toBe('string');
		expect(body.targetObject.polObjName.length).toBeGreaterThan(0);
		// F22-family: form validation state must not leak into the payload.
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted QoS create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);

		await refreshUntilRow(page, 'e2e-qos-min');

		const deletes = await captureDeletes(page, async () => {
			await selectRowByClick(page, 'e2e-qos-min', 'policyIdent');
			await toolbarButton(page, 'Delete').click();
			await confirmDelete(page);
			await expect(dialog(page).getByText('Deleted 1 item(s) successfully.')).toBeVisible();
			await dialogButton(page, 'OK').click();
		});
		expect(deletes).toHaveLength(1);
		expect(deletes[0].pathname).toContain('/config/policy/ident/e2e-qos-min');
		await refreshUntilGone(page, 'e2e-qos-min');
	});

	test('C-full: SrTCM + colorAware + block sizes all land in the POST body', async ({page}) => {
		await openAddDialog(page);
		await field(page, 'Policy Identifier').fill('e2e-qos-full');
		await selectOption(page, 'Type', 'SrTCM');
		await field(page, 'Color Aware').check();
		await field(page, 'Committed Info Rate(bps)').fill(CIR);
		await field(page, 'Peak Info Rate(bps)').fill(PIR);
		await field(page, 'Committed Block Size').fill('6000');
		await field(page, 'Excess Block Size').fill('12000');
		await attachToPort(page);

		const req = await submitAdd(page);
		const body = req.postDataJSON();

		expect(body.policyIdent).toBe('e2e-qos-full');
		expect(body.policyInfo).toMatchObject({
			type: 1,
			colorAware: true,
			committedInfoRate: 1000000000,
			peakInfoRate: 2000000000,
			committedBlkSize: 6000,
			excessBlkSize: 12000,
		});
		expect(body.isValid).toBeUndefined();
		expect(body.errors).toBeUndefined();

		expect((await req.response())?.status(), 'gateway accepted QoS create').toBeLessThan(300);
		await expectSuccessAndDismiss(page);
		await refreshUntilRow(page, 'e2e-qos-full');
	});

	test('V-rates: peak < committed — form submits but the app stays healthy either way', async ({page, consoleGuard}) => {
		// The metadata-driven form validates required/type/enum only, not the
		// peak≥committed relationship, so it submits; the gateway decides. Both
		// outcomes are acceptable as long as the app degrades cleanly (F15).
		consoleGuard.allow(/Failed to load resource/);
		consoleGuard.allow(/status of 4\d\d/);

		await openAddDialog(page);
		await field(page, 'Policy Identifier').fill('e2e-qos-inverted');
		await field(page, 'Committed Info Rate(bps)').fill(PIR); // committed > peak
		await field(page, 'Peak Info Rate(bps)').fill(CIR);
		await attachToPort(page);

		const req = await submitAdd(page);
		const status = (await req.response())?.status() ?? 0;

		// Either a Success popup (gateway accepted → afterEach sweep removes it)
		// or an Error popup (gateway rejected) — never an unhandled crash.
		await expect(dialogTitle(page, status < 300 ? 'Success' : 'Error')).toBeVisible();
		await dialogButton(page, 'OK').click();
	});
});
