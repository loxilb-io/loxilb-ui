//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IPortInfo} from 'types/port';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PortTable(props: {data: IPortInfo; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'port', header: 'Port No.', width: 'medium'},
		{data_key: 'name', header: 'Name', width: 'medium'},
		{data_key: 'mac', header: 'MAC', width: 'wide'},
		{data_key: 'link', header: 'Link/State', width: 'medium'},
		{data_key: 'route', header: 'Route', width: 'medium'},
		{data_key: 'ipv4', header: 'IP v4', width: 'wide'},
		{data_key: 'ipv6', header: 'IP v6', width: 'wide'},
		//{data_key: 'rx_tx_byte', header: 'RX/TX bytes', align: 'right', width: 'wide'},
		//{data_key: 'rx_tx_packet', header: 'RX/TX packets', align: 'right', width: 'wide'},
		//{data_key: 'rx_tx_error', header: 'RX/TX errors', align: 'right', width: 'wide'},
	];

   // Hash function for port
   const getHashKey = (item: any) => {
	   const str = `${item.portNo || ''}_${item.portName || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };

   const rows = data.portAttr
	   ? (() => {
		   const sorted = [...data.portAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map((item, index) => {
			   const hw = item.portHardwareInformation ?? {};
			   const l3 = item.portL3Information ?? {};
			   const stat = item.portStatisticInformation ?? {};

			   return {
				   id: index,
				   name: item.portName,
				   port: item.portNo,
				   mac: hw.macAddress ?? '',
				   link: `${hw.link ? 'Link' : 'No Link'}/${hw.state ? 'Up' : 'Down'}`,
				   route: l3.routed ? 'Routed' : 'Not Routed',
				   ipv4: Array.isArray(l3.IPv4Address) ? l3.IPv4Address.join(', ') : '',
				   ipv6: Array.isArray(l3.IPv6Address) ? l3.IPv6Address.join(', ') : '',
				   rx_tx_byte: `${stat.rxBytes ?? 0} / ${stat.txBytes ?? 0}`,
				   rx_tx_packet: `${stat.rxPackets ?? 0} / ${stat.txPackets ?? 0}`,
				   rx_tx_error: `${stat.rxErrors ?? 0} / ${stat.txErrors ?? 0}`,
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return (
		<DataTable
			name={'Port'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			hideIdColumn
			defaultSort={{field: 'port', sort: 'asc'}}
		/>
	);
}
