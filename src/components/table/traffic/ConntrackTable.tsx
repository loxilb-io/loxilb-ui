//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_ip_port_str, get_size_str} from 'common';
import DataTable from 'components/table/DataTable';
import {useInstanceName} from 'hooks/query/instanceHook';
import {ICtData} from 'types/conn_track';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ConntrackTable(props: {data: ICtData; selected_rows: number[]; onChangeSelectedRows: any; onRefresh?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onRefresh} = props;

	const inst_name = useInstanceName();

	const cols: IDataTableColumnDef[] = [
		{data_key: 'servename', header: 'Service Name', type: 'link', width: 'wide'},
		{data_key: 'source', header: 'Source', width: 'wide'},
		{data_key: 'destination', header: 'Destination', width: 'wide'},
		{data_key: 'protocol', header: 'Protocol', width: 'medium'},
		{data_key: 'conntrackState', header: 'State', width: 'medium'},
		{data_key: 'conntrackAct', header: 'Act', width: 'medium'},
		{data_key: 'usage', header: 'Usages', align: 'right', width: 'wide'},
	];

   // Simple hash function for composite key
   const getHashKey = (item: any) => {
	   const str = `${item.sourcePort || ''}_${item.destinationIP || ''}_${item.destinationPort || ''}_${item.protocol || ''}_${item.conntrackState || ''}_${item.conntrackAct || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0; // Convert to 32bit integer
	   }
	   return hash >>> 0; // Convert to unsigned 32-bit integer (always positive)
   };

   const rows = data.ctAttr
	   ? (() => {
		   const sorted = [...data.ctAttr].sort((a, b) => {
			   const keyA = getHashKey(a);
			   const keyB = getHashKey(b);
			   return keyA - keyB;
		   });
		   return sorted.map((item, index) => {
			   return {
				   id: index,
				   servename: {data: item.servName, url: `/instance/traffic/lb?name=${inst_name}&servName=${item.servName}`, toString: () => item.servName},
				   source: get_ip_port_str(item.sourceIP, item.sourcePort),
				   destination: get_ip_port_str(item.destinationIP, item.destinationPort),
				   protocol: item.protocol,
				   conntrackState: item.conntrackState,
				   conntrackAct: item.conntrackAct,
				   usage: item.bytes && item.packets ? `${get_size_str(item.bytes)} / ${item.packets} pkts` : ' ',
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'Connection Track'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onRefresh={onRefresh} />;
}
