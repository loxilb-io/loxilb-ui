//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {formatBytes, getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IBackupInfo} from 'types/backup';

//---------------------------------------------------------
// Interface
//---------------------------------------------------------
interface BackupTableProps {
	data: {backups: IBackupInfo[]};
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onAdd: () => void;
	onDelete: () => void;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BackupTable(props: BackupTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Backup Name', width: 'full'},
		{data_key: 'type', header: 'Type', width: 'medium'},
		{data_key: 'status', header: 'Status', width: 'medium'},
		// {data_key: 'priority', header: 'Priority', width: 'medium'},
		{data_key: 'size', header: 'Size', width: 'medium'},
		// {data_key: 'compressed', header: 'Compressed', width: 'narrow'},
		{data_key: 'created_at', header: 'Created At', width: 'wide'},
	];

	// Hash function for backup
	const getHashKey = (item: any) => {
		const str = `${item.path || ''}_${item.created || ''}_${item.size_bytes || ''}`;
		return getStableHash(str);
	};

	const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' => {
		switch (status?.toLowerCase()) {
			case 'completed': return 'success';
			case 'in_progress': return 'warning';
			case 'failed': return 'error';
			case 'scheduled': return 'info';
			default: return 'info';
		}
	};

	const getTypeColor = (type: string): 'primary' | 'secondary' | 'info' => {
		switch (type?.toLowerCase()) {
			case 'full': return 'primary';
			case 'incremental': return 'secondary';
			case 'selective': return 'info';
			default: return 'primary';
		}
	};

	// Generate rows and sort by hash key (for consistent initial display)
	const rows = data.backups
		? (() => {
			const sorted = [...data.backups].sort((a, b) => getHashKey(a) - getHashKey(b));
			return sorted.map((item, index) => {
				// Extract filename from path
				const filename = item.path ? item.path.split('/').pop() || `Backup ${index + 1}` : `Backup ${index + 1}`;
				
				// Determine status from available fields
				const status = item.checksum_valid ? 'completed' : 'failed';

				return {
					id: index,
					name: filename,
					type: item.type?.toUpperCase() || 'FULL',
					status: status.toUpperCase(),
					size: item.size_bytes ? formatBytes(item.size_bytes) : '-',
					priority: item.priority?.toUpperCase() || 'NORMAL',
					compressed: item.is_compressed ? 'Yes' : 'No',
					created_at: item.created ? new Date(item.created).toISOString().replace('T', ' ').substring(0, 19) : '-',
					_created_timestamp: item.created ? new Date(item.created).getTime() : 0, // Raw timestamp for sorting
					_uniqueKey: getHashKey(item),
				};
			});
		})()
		: undefined;

	return (
		<DataTable
			name={'Backup'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
		/>
	);
}
