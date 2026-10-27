//---------------------------------------------------------
// AI objectives table (gateway 9f5017e2)
//---------------------------------------------------------
// Sorted by priority, highest first, so the classes read top to bottom; the
// API lists by name. The class column is what governs admission.

import {getStableHash} from 'common';
import {PageDataState} from 'components/state/pageState';
import DataTable from 'components/table/DataTable';
import {t} from 'i18next';
import {IAIObjectiveEntry, objectiveClass} from 'types/ai_priority';
import {IDataTableColumnDef} from 'types/global';

export function sortObjectivesForDisplay(objectives: readonly IAIObjectiveEntry[]): IAIObjectiveEntry[] {
	return [...objectives].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''));
}

export default function ObjectiveTable(props: {
	data: IAIObjectiveEntry[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	state?: PageDataState<unknown>;
	/** The delete wording: what deleting an objective does to identities that name it. */
	deleteMessage?: string;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onEdit, onDelete, onRefresh, state, deleteMessage} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'medium', type: 'mono'},
		{data_key: 'priority', header: 'Priority', width: 'narrow', tooltip: 'Signed priority: positive is critical, zero standard, negative sheddable'},
		{data_key: 'class', header: 'Class', width: 'narrow'},
		{data_key: 'services', header: 'Services', width: 'wide', type: 'mono', tooltip: 'Services the objective applies to; empty means every service'},
		{data_key: 'updated_at', header: 'Updated', width: 'medium'},
	];

	const rows = sortObjectivesForDisplay(data).map(item => ({
		id: getStableHash(item.name ?? ''),
		name: item.name ?? '',
		priority: String(item.priority ?? 0),
		class: t(objectiveClass(item.priority)),
		services: (item.services ?? []).length > 0 ? (item.services ?? []).join(', ') : t('All services'),
		updated_at: item.updated_at ? new Date(item.updated_at).toLocaleString() : '–',
	}));

	return (
		<DataTable
			name={'Objectives'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onEdit}
			onDelete={onDelete}
			onRefresh={onRefresh}
			state={state}
			deleteConfirm={deleteMessage ? {title: t('Delete objective'), message: deleteMessage, confirmLabel: t('Delete')} : undefined}
		/>
	);
}
