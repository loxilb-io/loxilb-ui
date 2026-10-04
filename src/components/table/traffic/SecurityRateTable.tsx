//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {ISecurityRateEntry} from 'types/security';
import {IDataTableColumnDef} from 'types/global';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SecurityRateTableProps {
	data: ISecurityRateEntry[];
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onEdit?: () => void;
	onDisable?: () => void;
	onRefresh?: () => void;
	state?: PageDataState<unknown>;
	error?: boolean;
}

export default function SecurityRateTable(props: SecurityRateTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onEdit, onDisable, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'synEnabled', header: 'SYN Enabled', width: 'narrow'},
		{data_key: 'synThreshold', header: 'SYN Threshold', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'connRateEnabled', header: 'Conn Rate Enabled', width: 'medium'},
		{data_key: 'ratePerSec', header: 'Rate/Sec', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'udpEnabled', header: 'UDP Enabled', width: 'narrow'},
		{data_key: 'udpPktThreshold', header: 'UDP Pkt Threshold', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'synBlocked', header: 'SYN Blocked', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'connBlocked', header: 'Conn Blocked', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'udpBlocked', header: 'UDP Blocked', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'uniqueIps', header: 'Unique IPs', width: 'medium', align: 'right', type: 'mono'},
	];

	const getHashKey = (item: ISecurityRateEntry) => {
		const str = `${item.synEnabled}_${item.connRateEnabled}_${item.udpEnabled}`;
		return getStableHash(str);
	};

	const rows = data.map(item => ({
		id: getHashKey(item),
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
			onDelete={onDisable}
			deleteConfirm={
				onDisable
					? {
							title: 'Disable Security Rate Limiting',
							message:
								'This disables SYN flood, connection-rate, and UDP flood protection and clears all tracking state. Statistics counters are reset. You can re-enable it anytime via Configure.',
							confirmLabel: 'Disable',
							tooltip: 'Disable Security Rate Limiting',
							icon: 'block',
					  }
					: undefined
			}
			onRefresh={onRefresh}
			state={state}
			error={error}
		/>
	);
}
