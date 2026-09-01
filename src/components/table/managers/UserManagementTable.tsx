//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IUser} from 'types/oam';
import {PageDataState} from 'components/state/pageState';
import {t} from 'i18next';

//---------------------------------------------------------
// Interface
//---------------------------------------------------------
interface UserManagementTableProps {
	data: {users: IUser[]};
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onAdd?: () => void;
	onDelete?: () => void;
	onUpdate?: () => void;
	onRefresh?: () => void;
	currentUserId?: number;
	isAdmin?: boolean;
	state?: PageDataState<unknown>;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function UserManagementTable(props: UserManagementTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onUpdate, onRefresh, isAdmin = false, state} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'username', header: t('Username'), width: 'wide'},
		{data_key: 'email', header: t('Email'), width: 'super_wide'},
		{data_key: 'role', header: t('Role'), width: 'medium', type: 'tag'},
		{data_key: 'created_at', header: t('Created At'), width: 'medium', type: 'mono'},
	];

	// Hash function for user
	const getHashKey = (item: any) => {
		const str = `${item.id || ''}_${item.username || ''}_${item.email || ''}`;
		return getStableHash(str);
	};

	// Generate rows and sort by hash key
	const rows = data.users
		? (() => {
			const sorted = [...data.users].sort((a, b) => getHashKey(a) - getHashKey(b));
			return sorted.map((item, index) => {
				const formatDate = (dateStr?: string) => {
					if (!dateStr) return t('Unknown');
					return new Date(dateStr).toLocaleDateString();
				};

				const role = item.role || 'user';

				return {
					id: getHashKey(item),
					username: item.username || `User ${index + 1}`,
					email: item.email || '-',
					// Plain uppercase role in a neutral tag — no emoji icons in cells
					// (color budget: rows keep at most the status indicator colored).
					role: role.toUpperCase(),
					created_at: formatDate(item.created_at),
					_uniqueKey: getHashKey(item),
				};
			});
		})()
		: undefined;

	return (
		<DataTable
			name={'Users'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onUpdate}
			onDelete={onDelete}
			onRefresh={onRefresh}
			hideCheckbox={!isAdmin}
			state={state}
		/>
	);
}