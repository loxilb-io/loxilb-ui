//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {formatBytes, getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {ISnapshot} from 'types/snapshot';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Row shaping (docs/SNAPSHOT_UI_DESIGN.md §4)
//---------------------------------------------------------
// Chip palettes: every label carries the meaning in text, color is redundant.
const TRIGGER_CHIP: Record<string, {label: string; color?: string}> = {
	manual: {label: 'Manual'},
	scheduled: {label: 'Scheduled', color: 'info'},
	pre_upgrade: {label: 'Pre-Upgrade', color: 'warning'},
	pre_restore: {label: 'Pre-Restore', color: 'secondary'},
};

const RESTORE_CHIP: Record<string, {label: string; color?: string}> = {
	ok: {label: 'OK', color: 'success'},
	rolled_back: {label: 'Rolled back', color: 'warning'},
	rollback_failed: {label: 'Rollback failed', color: 'error'},
};

export function snapshot_to_row(snap: ISnapshot, index: number) {
	return {
		// Grid id is a stable hash of the snapshot UUID, so selection survives
		// the periodic list refetch/re-sort instead of shifting with array
		// position. The UUID itself is carried out-of-band as `sid` (DataTable
		// coerces selection ids with Number(), which a UUID string would break).
		id: getStableHash(snap.id ?? String(index)),
		sid: snap.id ?? '',
		name: snap.name ?? '',
		description: snap.description ?? '',
		trigger: TRIGGER_CHIP[snap.trigger_type ?? ''] ?? (snap.trigger_type ? {label: snap.trigger_type} : null),
		gateway_version: snap.gateway_version ?? '',
		size: snap.size_bytes !== undefined ? formatBytes(snap.size_bytes) : '',
		created_by: snap.created_by ?? '',
		created_at: snap.created_at ? new Date(snap.created_at).toLocaleString() : '',
		pinned: snap.pinned ? {label: 'Pinned', color: 'info'} : null,
		// Integrity sweep verdict: flag corrupt rows loudly, stay quiet when ok.
		integrity: snap.checksum_ok === false ? {label: 'Corrupt', color: 'error'} : null,
		last_restore: RESTORE_CHIP[snap.last_restore_result ?? ''] ?? null,
	};
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SnapshotTableProps {
	data: ISnapshot[];
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onRefresh?: () => void;
	onDelete?: () => void;
	state?: PageDataState<unknown>;
	error?: boolean;
}

export default function SnapshotTable(props: SnapshotTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onRefresh, onDelete, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'wide'},
		{data_key: 'description', header: 'Description', width: 'full'},
		{data_key: 'trigger', header: 'Trigger', width: 'medium', type: 'chip'},
		{data_key: 'gateway_version', header: 'GW Version', width: 'narrow', type: 'mono'},
		{data_key: 'size', header: 'Size', width: 'narrow', align: 'right', type: 'mono'},
		{data_key: 'created_by', header: 'Created By', width: 'narrow'},
		{data_key: 'created_at', header: 'Created At', width: 'wide', type: 'mono'},
		{data_key: 'pinned', header: 'Pinned', width: 'narrow', type: 'chip'},
		{data_key: 'integrity', header: 'Integrity', width: 'narrow', type: 'chip', tooltip: 'Result of the periodic stored-blob checksum sweep. A corrupt snapshot cannot be restored or downloaded.'},
		{data_key: 'last_restore', header: 'Last Restore', width: 'medium', type: 'chip'},
	];

	const rows = data.map(snapshot_to_row);

	return (
		<DataTable
			name={'Snapshots'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onRefresh={onRefresh}
			onDelete={onDelete}
			state={state}
			error={error}
			hideIdColumn
		/>
	);
}
