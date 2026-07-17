//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IIPsecTunnel} from 'types/ipsec';

//---------------------------------------------------------
// Helpers
//---------------------------------------------------------
export function formatBytes(n?: number): string {
	const v = n ?? 0;
	if (v >= 1024 * 1024 * 1024) return `${(v / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB`;
	if (v >= 1024) return `${(v / 1024).toFixed(1)} KB`;
	return `${v} B`;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPsecTunnelTable(props: {
	data: IIPsecTunnel[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onEdit, onDelete, onRefresh} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'medium'},
		{data_key: 'state', header: 'State', tooltip: 'Tunnel state (up / connecting / down)'},
		{data_key: 'peers', header: 'Local ⇄ Remote', width: 'wide'},
		{data_key: 'authMode', header: 'Auth'},
		{data_key: 'ikeVersion', header: 'IKE'},
		{data_key: 'sasInstalled', header: 'SAs', align: 'right', tooltip: 'Number of installed Security Associations'},
		{data_key: 'bytesIn', header: 'Bytes In', align: 'right'},
		{data_key: 'bytesOut', header: 'Bytes Out', align: 'right'},
		{data_key: 'installedAt', header: 'Created', width: 'medium'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		name: item.name ?? '',
		state: (item.state ?? 'down').toUpperCase(),
		peers: `${item.localIp ?? ''} ⇄ ${item.remoteIp ?? ''}`,
		authMode: item.authMode ?? '',
		ikeVersion: item.ikeVersion ?? '',
		sasInstalled: item.sasInstalled ?? 0,
		bytesIn: formatBytes(item.bytesIn),
		bytesOut: formatBytes(item.bytesOut),
		installedAt: item.installedAt ?? '',
	}));

	return (
		<DataTable
			name={'IPsec Tunnels'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onEdit}
			onDelete={onDelete}
			onRefresh={onRefresh}
			hideCheckbox={true}
		/>
	);
}
