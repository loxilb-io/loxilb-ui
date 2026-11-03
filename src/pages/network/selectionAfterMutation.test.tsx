//---------------------------------------------------------
// A row stays selected only until the next successful write.
//
// On 2026-11-02 the IP Address page deleted a bed's management address.
// The operator flow: tick the address, Edit it (Edit is a create, so the
// edited row stays in the list), tick the new address, Delete. The edited
// row was still selected, so Delete sent two requests and removed the
// address that was never ticked for deletion.
//
// These tests drive the page the same way and count the delete requests.
// The table is replaced by a probe that hands back the props the page gives
// it, so the selection is exactly what the page holds.
//---------------------------------------------------------
import 'locales/i18n';
import {getStableHash} from 'common';
import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {identifyFdbEntries} from 'types/fdb_identity';
import IPPage from './IPPage';
import FDBPage from './FDBPage';

type TableProps = {selected_rows: (string | number)[]; onChangeSelectedRows: (ids: (string | number)[]) => void; onDelete: () => Promise<void>; onUpdate?: () => void; onAdd?: () => void};
type Popup = {title: string; contents: any; onYes?: () => Promise<void> | void};

const state = vi.hoisted(() => ({
	popups: [] as Popup[],
	table: null as null | TableProps,
	ipData: [] as {dev: string; ipAddress: string[]}[],
	fdbData: [] as {macAddress: string; dev: string}[],
	createIp: vi.fn(),
	deleteIp: vi.fn(),
	createFdb: vi.fn(),
	deleteFdb: vi.fn(),
}));

const OK = {status: 'confirmed', code: 'ok', localeKey: 'ok', retryable: false};

vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'gw'})}));
vi.mock('hooks/popupHook', () => ({
	usePopUp: () => ({
		enableYes: () => undefined,
		openPopUp: (title: string, contents: unknown, _yes?: string, _no?: string, onYes?: () => Promise<void> | void) => {
			state.popups.push({title, contents, onYes});
		},
	}),
}));
vi.mock('hooks/query/queryHooks', () => ({
	useIPAttr: () => ({data: state.ipData, refetch: () => undefined, isSuccess: true, dataUpdatedAt: 1}),
	useFDB: () => ({data: state.fdbData, refetch: () => undefined, isSuccess: true, dataUpdatedAt: 1}),
}));
vi.mock('components/state/pageState', async importOriginal => ({
	...(await importOriginal<typeof import('components/state/pageState')>()),
	toPageState: () => ({kind: 'data'}),
}));
vi.mock('components/table/networks/IPTable', () => ({
	default: (props: TableProps) => {
		state.table = props;
		return null;
	},
}));
vi.mock('components/table/networks/FDBTable', () => ({
	default: (props: TableProps) => {
		state.table = props;
		return null;
	},
}));
vi.mock('components/view/IPAddressView', () => ({default: () => null}));
vi.mock('connector/instance/ip', () => ({
	request_create_ipv4: state.createIp,
	request_create_ipv6: state.createIp,
	request_delete_ipv4: state.deleteIp,
	request_delete_ipv6: state.deleteIp,
}));
vi.mock('connector/instance/fdb', () => ({request_create_fdb: state.createFdb, request_delete_fdb: state.deleteFdb}));

const table = (): TableProps => {
	if (!state.table) throw new Error('the page rendered no table');
	return state.table;
};
const last = () => state.popups[state.popups.length - 1];

/** What the grid does on a checkbox click: it reports the whole new selection. */
function tick(id: string | number) {
	act(() => table().onChangeSelectedRows([...table().selected_rows, id]));
}

/** Fill the dialog's form through the props the page gave it, then confirm. */
async function submitDialog(formData: Record<string, unknown>) {
	const dialog = last();
	act(() => dialog.contents.props.onChange(formData));
	await act(async () => {
		await dialog.onYes?.();
	});
}

beforeEach(() => {
	vi.useFakeTimers({toFake: ['setTimeout']});
	state.popups = [];
	state.table = null;
	for (const fn of [state.createIp, state.deleteIp, state.createFdb, state.deleteFdb]) fn.mockReset().mockResolvedValue(OK);
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('IP Address page: Edit, then Delete', () => {
	const PRIMARY = '192.168.0.10/24';
	const ADDED = '203.0.113.30/32';
	const rowId = (ip: string) => getStableHash(`enp0s4_${ip}`);

	it('deletes only the row ticked for deletion, never the row that was edited', async () => {
		state.ipData = [{dev: 'enp0s4', ipAddress: [PRIMARY]}];
		const view = render(<IPPage />);

		tick(rowId(PRIMARY));
		act(() => table().onUpdate?.());
		await submitDialog({dev: 'enp0s4', ipAddress: ADDED});
		expect(state.createIp).toHaveBeenCalledTimes(1);

		// The list now reads back with both addresses.
		state.ipData = [{dev: 'enp0s4', ipAddress: [PRIMARY, ADDED]}];
		view.rerender(<IPPage />);

		tick(rowId(ADDED));
		await act(async () => {
			await table().onDelete();
		});

		expect(state.deleteIp).toHaveBeenCalledTimes(1);
		expect(state.deleteIp).toHaveBeenCalledWith(expect.anything(), '203.0.113.30', 32, 'enp0s4');
	});

	it('a successful Edit leaves nothing selected', async () => {
		state.ipData = [{dev: 'enp0s4', ipAddress: [PRIMARY]}];
		render(<IPPage />);

		tick(rowId(PRIMARY));
		act(() => table().onUpdate?.());
		await submitDialog({dev: 'enp0s4', ipAddress: ADDED});

		expect(table().selected_rows).toEqual([]);
	});

	it('a failed Edit keeps the selection, so the operator can retry the same row', async () => {
		state.ipData = [{dev: 'enp0s4', ipAddress: [PRIMARY]}];
		state.createIp.mockResolvedValue({status: 'failed', code: 'x', localeKey: 'The operation could not be completed.', retryable: false});
		render(<IPPage />);

		tick(rowId(PRIMARY));
		act(() => table().onUpdate?.());
		await submitDialog({dev: 'enp0s4', ipAddress: ADDED});

		expect(table().selected_rows).toEqual([rowId(PRIMARY)]);
	});
});

describe('FDB page: Add, then Delete', () => {
	const KEPT = {macAddress: '02:00:00:00:00:01', dev: 'enp0s4'};
	const ADDED = {macAddress: '02:00:00:00:00:02', dev: 'enp0s4'};
	const idOf = (entries: typeof state.fdbData, mac: string) => identifyFdbEntries(entries).find(e => e.entry.macAddress === mac)!.id;

	it('a row ticked before an Add is not deleted with the new row', async () => {
		state.fdbData = [KEPT];
		const view = render(<FDBPage />);

		tick(idOf(state.fdbData, KEPT.macAddress));
		act(() => table().onAdd?.());
		await submitDialog(ADDED);
		expect(state.createFdb).toHaveBeenCalledTimes(1);

		state.fdbData = [KEPT, ADDED];
		view.rerender(<FDBPage />);

		tick(idOf(state.fdbData, ADDED.macAddress));
		await act(async () => {
			await table().onDelete();
		});

		expect(state.deleteFdb).toHaveBeenCalledTimes(1);
		expect(state.deleteFdb).toHaveBeenCalledWith(expect.anything(), ADDED.macAddress, ADDED.dev);
	});
});
