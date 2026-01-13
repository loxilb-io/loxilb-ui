//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {ISYNFloodEntry} from 'types/security';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SYNFloodTableProps {
	data: ISYNFloodEntry[];
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onEdit?: () => void;
	onRefresh?: () => void;
}

export default function SYNFloodTable(props: SYNFloodTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onEdit, onRefresh} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'enabled', header: 'Enabled', width: 'narrow'},
		{data_key: 'synThreshold', header: 'SYN Threshold', width: 'medium'},
		{data_key: 'cookieThreshold', header: 'Cookie Threshold', width: 'medium'},
		{data_key: 'totalSyns', header: 'Total SYNs', width: 'medium'},
		{data_key: 'blockedSyns', header: 'Blocked SYNs', width: 'medium'},
		{data_key: 'passedSyns', header: 'Passed SYNs', width: 'medium'},
		{data_key: 'cookieActivations', header: 'Cookie Activations', width: 'medium'},
		{data_key: 'uniqueIps', header: 'Unique IPs', width: 'medium'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		enabled: item.enabled ? 'Yes' : 'No',
		synThreshold: (item.synThreshold ?? 0).toString(),
		cookieThreshold: (item.cookieThreshold ?? 0).toString(),
		totalSyns: (item.totalSyns ?? 0).toString(),
		blockedSyns: (item.blockedSyns ?? 0).toString(),
		passedSyns: (item.passedSyns ?? 0).toString(),
		cookieActivations: (item.cookieActivations ?? 0).toString(),
		uniqueIps: (item.uniqueIps ?? 0).toString(),
	}));

	return (
		<DataTable
			name={'SYN Flood Protection'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onEdit={onEdit}
			onRefresh={onRefresh}
		/>
	);
}
