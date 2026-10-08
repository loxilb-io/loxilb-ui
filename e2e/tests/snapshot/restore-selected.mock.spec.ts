//---------------------------------------------------------
// Restore of selected domains (SNAPSEL-E2E-01..04), mock contract layer.
//---------------------------------------------------------
// The snapshot list, the restore route and the single-snapshot read are all
// answered here, so nothing in this file restores anything on the testbed.
//
// The restore answers are shaped the way OAM and the gateway give them: OAM
// answers 200 with the gateway's status and body inside, echoes the selection
// it forwarded as `components`, and the gateway's plan holds one row per
// domain it would replace. `plan` and `errors` are `null` when empty.
import type {Page, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {grid} from '../../helpers/table';

const PLAN = [
	{domain: 'loadbalancer', to_delete: 1, to_apply: 3},
	{domain: 'firewall', to_delete: 0, to_apply: 2},
	{domain: 'auditsink', to_delete: 2, to_apply: 1},
];
const SNAP_ID = 'e2e-mock-snap';
const PRE_ID = 'e2e-mock-pre';

type RestoreCall = {sid: string; mode: string; components?: string[]};
type Backend = {
	calls: RestoreCall[];
	/** False stands for a backend that does not know `components` and drops it. */
	knowsComponents: boolean;
};

let inst: {id: number; name: string};

const snapshotRow = (id: string, name: string, trigger_type: string) => ({
	id,
	name,
	instance_id: inst.id,
	trigger_type,
	checksum_ok: true,
	pinned: false,
	schema_version: '1.8',
	gateway_version: 'e2e',
	size_bytes: 1024,
	created_at: '2026-10-08T00:00:00Z',
	created_by: 'e2e',
	restore_count: 0,
});

/** A stand-in for OAM's snapshot list, single read and restore route. */
async function mockBackend(page: Page, start: Partial<Backend> = {}): Promise<Backend> {
	const be: Backend = {calls: [], knowsComponents: true, ...start};
	const json = (route: Route, status: number, body: unknown) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

	await page.route(/\/oam\/instances\/\d+\/snapshots(\?.*)?$/, (route: Route) => {
		if (route.request().method() !== 'GET') return json(route, 405, {error: 'not in this test'});
		return json(route, 200, {data: [snapshotRow(SNAP_ID, 'e2e-mock-selected', 'manual')], pagination: {page: 1, limit: 20, total_count: 1, total_pages: 1}});
	});
	await page.route(/\/oam\/snapshots\/[^/?]+$/, (route: Route) => {
		const sid = new URL(route.request().url()).pathname.split('/').pop()!;
		if (route.request().method() !== 'GET') return json(route, 405, {error: 'not in this test'});
		return sid === PRE_ID ? json(route, 200, snapshotRow(PRE_ID, 'pre-restore-e2e-mock', 'pre_restore')) : json(route, 404, {error: 'snapshot not found'});
	});
	await page.route(/\/oam\/snapshots\/[^/]+\/restore$/, (route: Route) => {
		const sid = new URL(route.request().url()).pathname.split('/').slice(-2)[0];
		const body = JSON.parse(route.request().postData() ?? '{}') as {mode: string; components?: string[]};
		be.calls.push({sid, mode: body.mode, ...(body.components ? {components: body.components} : {})});
		const used = be.knowsComponents ? body.components : undefined;
		const commit = body.mode === 'commit';
		return json(route, 200, {
			snapshot_id: sid,
			instance_id: inst.id,
			mode: body.mode,
			cross_instance: false,
			gateway_status: 200,
			...(used ? {components: used} : {}),
			...(commit ? {pre_restore_snapshot_id: PRE_ID} : {}),
			gateway_response: {
				mode: body.mode,
				compatible: true,
				schema_version: '1.8',
				snapshot_gateway_version: 'e2e',
				current_gateway_version: 'e2e',
				plan: used ? PLAN.filter(p => used.includes(p.domain)) : PLAN,
				errors: null,
				result: 'ok',
				...(commit ? {persisted: true} : {}),
			},
		});
	});
	return be;
}

async function openWizard(page: Page) {
	await page.goto(`instance/maintenance/snapshots?name=${inst.name}`);
	const row = grid(page).locator('.MuiDataGrid-row').filter({has: page.locator('[data-field="name"] :text-is("e2e-mock-selected")')});
	await expect(row).toHaveCount(1, {timeout: 20_000});
	await row.getByRole('checkbox').check();
	await page.getByRole('button', {name: 'Restore…'}).click();
	const wizard = page.getByRole('dialog', {name: /Restore Snapshot/});
	await expect(wizard.getByText('Dry-run passed — the snapshot is applicable')).toBeVisible({timeout: 20_000});
	return wizard;
}

async function confirmAndCommit(wizard: ReturnType<Page['getByRole']>) {
	await wizard.getByRole('button', {name: 'Continue to Restore'}).click();
	await wizard.getByLabel('Type the instance name to confirm').fill(inst.name);
	await wizard.getByRole('button', {name: 'Restore Now'}).click();
	await expect(wizard.getByRole('button', {name: 'Close'})).toBeVisible({timeout: 20_000});
}

test.describe('@gw Restore of selected domains (mock)', () => {
	test.beforeAll(async () => {
		inst = await activeInstance();
	});

	test('SNAPSEL-E2E-01: a selection gets its own dry-run and the commit carries the same list', async ({page}) => {
		const be = await mockBackend(page);
		const wizard = await openWizard(page);
		for (const d of ['loadbalancer', 'firewall', 'auditsink']) await expect(wizard.getByLabel(`Restore ${d}`)).toBeChecked();

		await wizard.getByLabel('Restore loadbalancer').uncheck();
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toHaveCount(0);
		await wizard.getByRole('button', {name: 'Dry-run Selected Domains'}).click();
		await expect(wizard.getByText('Dry-run of the selected domains: firewall, auditsink')).toBeVisible();
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toBeEnabled();

		await wizard.getByRole('button', {name: 'Continue to Restore'}).click();
		await expect(wizard.getByText(/This replaces these domains on .* holds: firewall, auditsink\./)).toBeVisible();
		// The selection includes the audit sinks, so what happens to them is said.
		await expect(wizard.getByText('This restore includes the audit sinks')).toBeVisible();
		await wizard.getByLabel('Type the instance name to confirm').fill(inst.name);
		await wizard.getByRole('button', {name: 'Restore Now'}).click();
		await expect(wizard.getByText('Restore succeeded')).toBeVisible({timeout: 20_000});
		await expect(wizard.getByText('Sent for these domains only: firewall, auditsink. Other domains were not part of this restore.')).toBeVisible();

		expect(be.calls).toEqual([
			{sid: SNAP_ID, mode: 'dry-run'},
			{sid: SNAP_ID, mode: 'dry-run', components: ['firewall', 'auditsink']},
			{sid: SNAP_ID, mode: 'commit', components: ['firewall', 'auditsink']},
		]);
	});

	test('SNAPSEL-E2E-02: a backend that answers for the whole document does not unlock the restore', async ({page}) => {
		const be = await mockBackend(page, {knowsComponents: false});
		const wizard = await openWizard(page);
		await wizard.getByLabel('Restore loadbalancer').uncheck();
		await wizard.getByRole('button', {name: 'Dry-run Selected Domains'}).click();
		await expect(wizard.getByText('The dry-run did not answer for the selected domains')).toBeVisible();
		await expect(wizard.getByText(/Selected: firewall, auditsink\. Answered for: loadbalancer, firewall, auditsink\./)).toBeVisible();
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toBeDisabled();
		expect(be.calls.filter(c => c.mode === 'commit')).toEqual([]);
	});

	test('SNAPSEL-E2E-03: with every domain cleared nothing is sent', async ({page}) => {
		const be = await mockBackend(page);
		const wizard = await openWizard(page);
		for (const d of ['loadbalancer', 'firewall', 'auditsink']) await wizard.getByLabel(`Restore ${d}`).uncheck();
		await expect(wizard.getByText('Tick at least one domain. A restore of no domains is not sent.')).toBeVisible();
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toBeDisabled();
		await expect(wizard.getByRole('button', {name: 'Dry-run Selected Domains'})).toHaveCount(0);
		// The dry-run of the whole document that the wizard opens with, and no other call.
		expect(be.calls).toEqual([{sid: SNAP_ID, mode: 'dry-run'}]);
	});

	test('SNAPSEL-E2E-04: undo restores the pre-restore snapshot for the same domains, dry-run first', async ({page}) => {
		const be = await mockBackend(page);
		const wizard = await openWizard(page);
		await wizard.getByLabel('Restore loadbalancer').uncheck();
		await wizard.getByLabel('Restore auditsink').uncheck();
		await wizard.getByRole('button', {name: 'Dry-run Selected Domains'}).click();
		await expect(wizard.getByRole('button', {name: 'Continue to Restore'})).toBeEnabled();
		await confirmAndCommit(wizard);

		be.calls.length = 0;
		await wizard.getByRole('button', {name: 'Undo This Restore…'}).click();
		const undo = page.getByRole('dialog', {name: /Restore Snapshot: pre-restore-e2e-mock/});
		await expect(undo.getByText(/Undo: this is the pre-restore snapshot/)).toBeVisible();
		await expect(undo.getByText('Dry-run passed — the snapshot is applicable')).toBeVisible({timeout: 20_000});
		await expect(undo.getByLabel('Restore firewall')).toBeChecked();
		await expect(undo.getByLabel('Restore loadbalancer')).not.toBeChecked();
		await expect(undo.getByLabel('Restore auditsink')).not.toBeChecked();

		await undo.getByRole('button', {name: 'Dry-run Selected Domains'}).click();
		await expect(undo.getByRole('button', {name: 'Continue to Restore'})).toBeEnabled();
		await confirmAndCommit(undo);
		expect(be.calls).toEqual([
			{sid: PRE_ID, mode: 'dry-run'},
			{sid: PRE_ID, mode: 'dry-run', components: ['firewall']},
			{sid: PRE_ID, mode: 'commit', components: ['firewall']},
		]);
	});
});
