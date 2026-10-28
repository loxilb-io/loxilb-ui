// UC-8 objective CRUD on an explicitly selected, dedicated QA instance.
// Config/readback only: this does not prove request scheduling or traffic.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, gw} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {rowByText, toolbarButton} from '../../helpers/table';

const instanceName = process.env.E2E_INSTANCE_NAME;
const allowed = process.env.UC8_QA_ALLOW_MUTATIONS === '1' && instanceName === 'uc8qa-gateway';
const name = `uc8qa-${Date.now().toString(36)}`;
const sshHost = process.env.UC8_QA_SSH_HOST ?? '';
const gatewayContainer = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';

function cliPriority(): number | null {
	const raw = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', sshHost,
		'docker', 'exec', gatewayContainer, 'loxicmd', 'get', 'objective', '-o', 'json'], {encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe']});
	const body = JSON.parse(raw) as {objectiveAttr?: {name: string; priority: number}[]};
	return body.objectiveAttr?.find(item => item.name === name)?.priority ?? null;
}
let createdOrAttempted = false;

test.describe.serial('UC8-LIVE-OBJECTIVE: objective UI and Gateway readback', () => {
	test.skip(!allowed, 'Requires UC8_QA_ALLOW_MUTATIONS=1 and the dedicated uc8qa-gateway instance.');

	test.beforeAll(async () => {
		expect(sshHost, 'set a safe QA SSH host').toMatch(/^[a-zA-Z0-9._-]+$/);
		expect(gatewayContainer, 'set the owned QA gateway container').toMatch(/^uc8qa-[a-z0-9-]+$/);
		const instance = await activeInstance();
		expect(instance.name).toBe(instanceName);
		const response = await gw('GET', '/config/ai/objective');
		expect(response.status, 'objective store must be ready before mutation').toBe(200);
	});

	test.afterAll(async () => {
		if (!createdOrAttempted) return;
		// This exact run-generated name is the only object eligible for cleanup.
		const response = await gw('DELETE', `/config/ai/objective/${encodeURIComponent(name)}`);
		expect([200, 204, 404]).toContain(response.status);
	});

	test('create, replace and delete one owned objective', async ({page}) => {
		await page.goto(`instance/ai/objectives?name=${encodeURIComponent(instanceName!)}`);
		await openToolbarDialog(page, 'Add', dialogTitle(page, 'New Objective'));
		await field(page, 'Name').fill(name);
		await field(page, 'Priority').fill('10');
		createdOrAttempted = true;
		await dialogButton(page, 'Add').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
		const row = rowByText(page, name).first();
		await expect(row).toBeVisible({timeout: 15_000});
		await expect(row).toContainText('critical');
		await expect.poll(async () => {
			const response = await gw('GET', '/config/ai/objective');
			if (response.status !== 200) return null;
			const body = await response.json();
			return body.objectiveAttr?.find((item: {name: string}) => item.name === name)?.priority ?? null;
		}).toBe(10);
		await expect.poll(cliPriority).toBe(10);

		await row.getByRole('checkbox').check();
		await openToolbarDialog(page, 'Edit', dialogTitle(page, 'Edit Objective'));
		await expect(field(page, 'Name')).toBeDisabled();
		await field(page, 'Priority').fill('-5');
		await dialogButton(page, 'Save').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
		await expect(row).toContainText('sheddable');
		await expect.poll(async () => {
			const response = await gw('GET', '/config/ai/objective');
			if (response.status !== 200) return null;
			const body = await response.json();
			return body.objectiveAttr?.find((item: {name: string}) => item.name === name)?.priority ?? null;
		}).toBe(-5);
		await expect.poll(cliPriority).toBe(-5);

		await row.getByRole('checkbox').check();
		await toolbarButton(page, 'Delete').click();
		await expect(dialog(page).getByRole('heading', {name: 'Delete objective'})).toBeVisible();
		await dialogButton(page, 'Delete').click();
		await expect(dialogTitle(page, 'Success')).toBeVisible();
		await dialogButton(page, 'OK').click();
		await expect(row).toHaveCount(0);
		await expect.poll(async () => {
			const response = await gw('GET', '/config/ai/objective');
			if (response.status !== 200) return true;
			const body = await response.json();
			return (body.objectiveAttr ?? []).some((item: {name: string}) => item.name === name);
		}).toBe(false);
		await expect.poll(cliPriority).toBeNull();
	});
});
