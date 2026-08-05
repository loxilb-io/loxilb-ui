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
		{data_key: 'spi', header: 'SPI', width: 'medium', type: 'mono'},
		{data_key: 'tunnelName', header: 'Tunnel', width: 'medium'},
		{data_key: 'direction', header: 'Dir', type: 'tag'},
		{data_key: 'state', header: 'State', type: 'state', tooltip: 'SA state (active / rekeying / expired)'},
		{data_key: 'algo', header: 'Algorithms', width: 'wide', type: 'mono'},
		{data_key: 'bytesIn', header: 'Bytes In', align: 'right', type: 'mono'},
		{data_key: 'bytesOut', header: 'Bytes Out', align: 'right', type: 'mono'},
		{data_key: 'expiresAt', header: 'Expires', width: 'medium', type: 'mono', tooltip: 'SA lifetime end (rekey happens before this)'},
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
