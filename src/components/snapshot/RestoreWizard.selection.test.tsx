//---------------------------------------------------------
// Restoring selected domains, through the whole wizard
//---------------------------------------------------------
// The wizard may only commit what a dry-run verified. For a selection that
// means: the list comes from the plan of the whole-document dry-run, the
// selection gets a dry-run of its own, the commit carries the same list, and
// an undo restores the pre-restore snapshot for the same list. The connector
// is replaced; every call it receives is asserted.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import RestoreWizard from './RestoreWizard';
import {IRestoreOutcomeParsed, ISnapshot} from 'types/snapshot';

const api = vi.hoisted(() => ({request_restore_snapshot: vi.fn(), query_get_snapshot: vi.fn()}));
vi.mock('connector/oam/snapshotApi', () => api);

const PLAN = [
	{domain: 'loadbalancer', to_delete: 1, to_apply: 3},
	{domain: 'firewall', to_delete: 0, to_apply: 2},
	{domain: 'auditsink', to_delete: 2, to_apply: 1},
];
const planFor = (components?: readonly string[]) => (components ? PLAN.filter(p => components.includes(p.domain)) : PLAN);

// Answers the way OAM and the gateway do: the selection is echoed and the
// plan holds the selected domains only.
const answer = (mode: 'dry-run' | 'commit', components?: readonly string[], extra: Record<string, unknown> = {}) => ({
	status: 'confirmed',
	data: {
		mode,
		gateway_status: 200,
		...(components ? {components: [...components]} : {}),
		...(mode === 'commit' ? {pre_restore_snapshot_id: 'pre-1'} : {}),
		gateway_response: {mode, compatible: true, plan: planFor(components), errors: null, result: 'ok', ...(mode === 'commit' ? {persisted: true} : {}), ...extra},
	} as IRestoreOutcomeParsed,
});

const SNAP = {id: 's1', name: 'nightly'} as ISnapshot;
const mount = () => render(<RestoreWizard open snapshot={SNAP} instanceName="gw-1" onClose={() => {}} />);
const calls = () => api.request_restore_snapshot.mock.calls.map(c => ({sid: c[0], mode: c[1], components: c[3]}));
const box = (domain: string) => screen.getByLabelText(`Restore ${domain}`) as HTMLInputElement;
const button = (name: string) => screen.getByRole('button', {name}) as HTMLButtonElement;

async function confirmAndCommit() {
	fireEvent.click(button('Continue to Restore'));
	fireEvent.change(screen.getByLabelText('Type the instance name to confirm'), {target: {value: 'gw-1'}});
	fireEvent.click(button('Restore Now'));
	await screen.findByRole('button', {name: 'Close'});
}

beforeEach(() => {
	api.request_restore_snapshot.mockReset();
	api.query_get_snapshot.mockReset();
	api.request_restore_snapshot.mockImplementation(async (_sid: string, mode: 'dry-run' | 'commit', _t?: number, components?: readonly string[]) => answer(mode, components));
});
afterEach(() => {
	cleanup();
});

describe('the whole document', () => {
	it('ticks every domain of the plan and commits with no list', async () => {
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		for (const d of ['loadbalancer', 'firewall', 'auditsink']) expect(box(d).checked).toBe(true);
		await confirmAndCommit();
		expect(calls()).toEqual([
			{sid: 's1', mode: 'dry-run', components: undefined},
			{sid: 's1', mode: 'commit', components: undefined},
		]);
		expect(screen.queryByText(/Sent for these domains only/)).toBeNull();
	});
});

describe('a selection', () => {
	it('cannot be restored until it has had its own dry-run, and commits the same list', async () => {
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('loadbalancer'));

		// The whole-document dry-run does not cover the selection.
		expect(screen.queryByRole('button', {name: 'Continue to Restore'})).toBeNull();
		fireEvent.click(button('Dry-run Selected Domains'));
		await screen.findByText('Dry-run of the selected domains: firewall, auditsink');
		await waitFor(() => expect(button('Continue to Restore').disabled).toBe(false));

		fireEvent.click(button('Continue to Restore'));
		expect(screen.getByText(/This replaces these domains on "gw-1" with what snapshot "nightly" holds: firewall, auditsink\./)).toBeTruthy();
		fireEvent.change(screen.getByLabelText('Type the instance name to confirm'), {target: {value: 'gw-1'}});
		fireEvent.click(button('Restore Now'));
		await screen.findByText('Sent for these domains only: firewall, auditsink. Other domains were not part of this restore.');

		expect(calls()).toEqual([
			{sid: 's1', mode: 'dry-run', components: undefined},
			{sid: 's1', mode: 'dry-run', components: ['firewall', 'auditsink']},
			{sid: 's1', mode: 'commit', components: ['firewall', 'auditsink']},
		]);
	});

	it('needs a new dry-run when the ticked domains change after one', async () => {
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('loadbalancer'));
		fireEvent.click(button('Dry-run Selected Domains'));
		await waitFor(() => expect(button('Continue to Restore').disabled).toBe(false));

		fireEvent.click(box('firewall'));
		expect(screen.queryByRole('button', {name: 'Continue to Restore'})).toBeNull();
		expect(screen.queryByText(/Dry-run of the selected domains/)).toBeNull();
		expect(button('Dry-run Selected Domains')).toBeTruthy();
	});

	it('sends nothing when every domain is cleared', async () => {
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		for (const d of ['loadbalancer', 'firewall', 'auditsink']) fireEvent.click(box(d));
		expect(screen.getByText('Tick at least one domain. A restore of no domains is not sent.')).toBeTruthy();
		expect(button('Continue to Restore').disabled).toBe(true);
		expect(screen.queryByRole('button', {name: 'Dry-run Selected Domains'})).toBeNull();
		expect(calls()).toHaveLength(1);
	});

	it('cannot continue when the backend answered for the whole document instead', async () => {
		// A backend that does not know `components`: 200, passed, every domain.
		api.request_restore_snapshot.mockImplementation(async (_sid: string, mode: 'dry-run' | 'commit') => answer(mode));
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('loadbalancer'));
		fireEvent.click(button('Dry-run Selected Domains'));
		await screen.findByText('The dry-run did not answer for the selected domains');
		expect(screen.getByText(/Selected: firewall, auditsink\. Answered for: loadbalancer, firewall, auditsink\./)).toBeTruthy();
		expect(button('Continue to Restore').disabled).toBe(true);
	});

	it('cannot continue when the dry-run of the selection got no answer', async () => {
		api.request_restore_snapshot.mockImplementation(async (_sid: string, mode: 'dry-run' | 'commit', _t?: number, components?: readonly string[]) =>
			components ? {status: 'unavailable', localeKey: 'The service is unavailable.', rawDetail: 'gateway unreachable'} : answer(mode),
		);
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('loadbalancer'));
		fireEvent.click(button('Dry-run Selected Domains'));
		await screen.findByText(/gateway unreachable/);
		expect(button('Continue to Restore').disabled).toBe(true);
	});

	it('says so when the commit answered for other domains than the selection', async () => {
		api.request_restore_snapshot.mockImplementation(async (_sid: string, mode: 'dry-run' | 'commit', _t?: number, components?: readonly string[]) =>
			mode === 'commit' ? answer('commit') : answer(mode, components),
		);
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('loadbalancer'));
		fireEvent.click(button('Dry-run Selected Domains'));
		await waitFor(() => expect(button('Continue to Restore').disabled).toBe(false));
		await confirmAndCommit();
		expect(screen.getByText('The answer is not for the selected domains')).toBeTruthy();
		expect(screen.queryByText(/Sent for these domains only/)).toBeNull();
	});
});

describe('the audit sinks', () => {
	const NOTE = 'This restore includes the audit sinks';

	it('are warned about before a restore that includes them', async () => {
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(button('Continue to Restore'));
		expect(screen.getByText(NOTE)).toBeTruthy();
	});

	it('are not mentioned when the selection leaves them out', async () => {
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('auditsink'));
		fireEvent.click(button('Dry-run Selected Domains'));
		await waitFor(() => expect(button('Continue to Restore').disabled).toBe(false));
		fireEvent.click(button('Continue to Restore'));
		expect(screen.queryByText(NOTE)).toBeNull();
	});
});

describe('undo', () => {
	const PRE = {id: 'pre-1', name: 'pre-restore-20261008-000000'} as ISnapshot;

	it('restores the pre-restore snapshot for the same domains, dry-run first', async () => {
		api.query_get_snapshot.mockResolvedValue(PRE);
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		fireEvent.click(box('loadbalancer'));
		fireEvent.click(box('auditsink'));
		fireEvent.click(button('Dry-run Selected Domains'));
		await waitFor(() => expect(button('Continue to Restore').disabled).toBe(false));
		await confirmAndCommit();

		api.request_restore_snapshot.mockClear();
		fireEvent.click(button('Undo This Restore…'));
		await screen.findByText(/Undo: this is the pre-restore snapshot/);
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		expect(api.query_get_snapshot).toHaveBeenCalledWith('pre-1');
		expect(screen.getByText(/pre-restore-20261008-000000/)).toBeTruthy();
		// The domains of the restore being undone, and only those.
		expect(box('firewall').checked).toBe(true);
		expect(box('loadbalancer').checked).toBe(false);
		expect(box('auditsink').checked).toBe(false);

		fireEvent.click(button('Dry-run Selected Domains'));
		await waitFor(() => expect(button('Continue to Restore').disabled).toBe(false));
		await confirmAndCommit();
		expect(calls()).toEqual([
			{sid: 'pre-1', mode: 'dry-run', components: undefined},
			{sid: 'pre-1', mode: 'dry-run', components: ['firewall']},
			{sid: 'pre-1', mode: 'commit', components: ['firewall']},
		]);
	});

	it('is the whole pre-restore snapshot after a whole-document restore', async () => {
		api.query_get_snapshot.mockResolvedValue(PRE);
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		await confirmAndCommit();
		fireEvent.click(button('Undo This Restore…'));
		await screen.findByText(/Undo: this is the pre-restore snapshot/);
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		for (const d of ['loadbalancer', 'firewall', 'auditsink']) expect(box(d).checked).toBe(true);
	});

	it('is not offered when the restore was rolled back', async () => {
		api.request_restore_snapshot.mockImplementation(async (_sid: string, mode: 'dry-run' | 'commit') => {
			if (mode === 'dry-run') return answer(mode);
			const a = answer('commit', undefined, {result: 'rolled-back', errors: ['apply firewall: boom'], persisted: undefined});
			return {...a, data: {...a.data, gateway_status: 500}};
		});
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		await confirmAndCommit();
		expect(screen.getByText('Restore failed and was rolled back')).toBeTruthy();
		expect(screen.queryByRole('button', {name: 'Undo This Restore…'})).toBeNull();
	});

	it('stays on the result and says why when the pre-restore snapshot cannot be read', async () => {
		api.query_get_snapshot.mockRejectedValue(new Error('Get Snapshot failed: 404'));
		mount();
		await screen.findByText('Dry-run passed — the snapshot is applicable');
		await confirmAndCommit();
		fireEvent.click(button('Undo This Restore…'));
		await screen.findByText('The pre-restore snapshot could not be read: Get Snapshot failed: 404');
		expect(screen.getByText('Restore succeeded')).toBeTruthy();
	});
});
