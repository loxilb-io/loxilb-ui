//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IIPsecSA} from 'types/ipsec';
import {formatBytes} from './IPsecTunnelTable';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPsecSATable(props: {data: IIPsecSA[]; onRefresh?: () => void}) {
	const {data, onRefresh} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'spi', header: 'SPI', width: 'medium'},
		{data_key: 'tunnelName', header: 'Tunnel', width: 'medium'},
		{data_key: 'direction', header: 'Dir'},
		{data_key: 'state', header: 'State', tooltip: 'SA state (active / rekeying / expired)'},
		{data_key: 'algo', header: 'Algorithms', width: 'wide'},
		{data_key: 'bytesIn', header: 'Bytes In', align: 'right'},
		{data_key: 'bytesOut', header: 'Bytes Out', align: 'right'},
		{data_key: 'expiresAt', header: 'Expires', width: 'medium', tooltip: 'SA lifetime end (rekey happens before this)'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		spi: item.spi ?? '',
		tunnelName: item.tunnelName ?? '',
		direction: (item.direction ?? '').toUpperCase(),
		state: (item.state ?? '').toUpperCase(),
		algo: [item.encryption, item.integrity].filter(Boolean).join(' / '),
		bytesIn: formatBytes(item.bytesIn),
		bytesOut: formatBytes(item.bytesOut),
		expiresAt: item.expiresAt ?? '',
	}));

	return (
		<DataTable
			name={'Security Associations'}
			columns={cols}
			rows={rows}
			selected_rows={[]}
			onChangeSelectedRows={() => {}}
			onRefresh={onRefresh}
			hideCheckbox={true}
			disableSelect={true}
		/>
	);
}
