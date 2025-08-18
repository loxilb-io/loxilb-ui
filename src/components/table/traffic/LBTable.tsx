//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import modes from 'assets/json/modes.json';
import sels from 'assets/json/sels.json';
import { getStableHash } from 'common';
import DataTable from 'components/table/DataTable';
import { stableValueHash } from 'react-query/types/core/utils';
import {IDataTableColumnDef, IEnumItem} from 'types/global';
import {ILBData} from 'types/load_balancer';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBTable(props: {data: ILBData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const sel_list: IEnumItem[] = sels;
	const mode_list: IEnumItem[] = modes;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'externalIP', header: 'External IP', width: 'wide'},
		{data_key: 'port', header: 'Port'},
		{data_key: 'protocol', header: 'Protocol'},
		{data_key: 'name', header: 'Service Name', width: 'wide'},
		{data_key: 'sel', header: 'Sel', tooltip: 'value for load balance algorithim(0-rr, 1-hash, 2-priority, 3-persist, 4-lc, 5-n2, 6-n3, 0-default)', width: 'narrow'},
		{data_key: 'mode', header: 'Mode', tooltip: 'value for NAT mode (0-DNAT,1-onearm, 2-fullnat, 3-dsr, 4-fullproxy, 5-hostonearm, 0-default)', width: 'narrow'},
		{data_key: 'monitor', header: 'Monitor'},
		{data_key: 'probeTimeout', header: 'Timeout (Sec)'},		
		{data_key: 'endpoints', header: 'Endpoints', width: 'wide'},
		{data_key: 'mark', header: 'Mark'},
	];

   // Simple hash function for composite key
   const getHashKey = (item: any) => {
	   const str = `${item.serviceArguments.externalIP || ''}_${item.serviceArguments.port || ''}_${item.serviceArguments.protocol || ''}`;
	   return getStableHash(str);
   };

   // Generate rows and sort by hash key (externalIP, port, protocol)
   const rows = data.lbAttr
	   ? (() => {
		   const sorted = [...data.lbAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map((item, index) => {
			   const hashKey = getHashKey(item);
			   const mark = item.serviceArguments.block ?? 0;
			   const timeout = item.serviceArguments.probeTimeout ?? 1800;

			   const sel = item.serviceArguments.sel ?? 0;
			   const mode = item.serviceArguments.mode ?? 0;

			   const sel_value = sel_list.find(item2 => item2.id === sel)?.name || '';
			   const mode_value = mode_list.find(item2 => item2.id === mode)?.name || '';

			   return {
				   id: index, // Use hash as row ID
				   externalIP: item.serviceArguments.externalIP,
				   port: item.serviceArguments.port,
				   protocol: item.serviceArguments.protocol,
				   name: item.serviceArguments.name,
				   mark: mark,
				   sel: sel_value,
				   mode: mode_value,
				   probeTimeout: timeout,
				   monitor: item.serviceArguments.monitor ? 'Enabled' : 'Disabled',
				   endpoints: item.endpoints.length,
				   // Unique key for sorting
				   _uniqueKey: getHashKey(item),
			   }
		   });
	   })()
	   : undefined;

	return (
	   <DataTable name={'Load Balancer'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />
	);
}
