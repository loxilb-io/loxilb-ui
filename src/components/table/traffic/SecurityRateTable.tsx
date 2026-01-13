//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {ISecurityRateEntry} from 'types/security';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SecurityRateTableProps {
	data: ISecurityRateEntry[];
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onEdit?: () => void;
	onRefresh?: () => void;
}

export default function SecurityRateTable(props: SecurityRateTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onEdit, onRefresh} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'synEnabled', header: 'SYN Enabled', width: 'narrow'},
		{data_key: 'synThreshold', header: 'SYN Threshold', width: 'medium'},
		{data_key: 'connRateEnabled', header: 'Conn Rate Enabled', width: 'medium'},
		{data_key: 'ratePerSec', header: 'Rate/Sec', width: 'medium'},
		{data_key: 'udpEnabled', header: 'UDP Enabled', width: 'narrow'},
		{data_key: 'udpPktThreshold', header: 'UDP Pkt Threshold', width: 'medium'},
		{data_key: 'synBlocked', header: 'SYN Blocked', width: 'medium'},
		{data_key: 'connBlocked', header: 'Conn Blocked', width: 'medium'},
		{data_key: 'udpBlocked', header: 'UDP Blocked', width: 'medium'},
		{data_key: 'uniqueIps', header: 'Unique IPs', width: 'medium'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		synEnabled: item.synEnabled ? 'Yes' : 'No',
		synThreshold: (item.synThreshold ?? 0).toString(),
		connRateEnabled: item.connRateEnabled ? 'Yes' : 'No',
		ratePerSec: (item.ratePerSec ?? 0).toString(),
		udpEnabled: item.udpEnabled ? 'Yes' : 'No',
		udpPktThreshold: (item.udpPktThreshold ?? 0).toString(),
		synBlocked: (item.synBlocked ?? 0).toString(),
		connBlocked: (item.connBlocked ?? 0).toString(),
		udpBlocked: (item.udpBlocked ?? 0).toString(),
		uniqueIps: (item.uniqueIps ?? 0).toString(),
	}));

	return (
		<DataTable
			name={'Security Rate Limiting'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onEdit={onEdit}
			onRefresh={onRefresh}
		/>
	);
}
