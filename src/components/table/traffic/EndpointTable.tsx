//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash } from 'common';
import DataTable from 'components/table/DataTable';
import {IEndpointAttr} from 'types/endpoint';
import {IDataTableColumnDef} from 'types/global';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function EndpointTable(props: {data: IEndpointAttr; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onUpdate?: any; onRefresh?: any; state?: PageDataState<unknown>; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onUpdate, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'hostName', header: 'Host Name', type: 'mono'},
		{data_key: 'name', header: 'Name', width: 'wide'},
		{data_key: 'currState', header: 'State', type: 'state', width: 'medium'},
		{data_key: 'probeType', header: 'Probe Type', width: 'medium', type: 'tag', tooltip: 'if probe type is none, endpoint will be active in every time'},
		{data_key: 'probePort', header: 'Probe Port', align: 'right', type: 'mono'},
		{data_key: 'probeDuration', header: 'Probe Duration', align: 'right', type: 'mono'},
		{data_key: 'inactiveReTries', header: 'Retries', align: 'right', type: 'mono'},
	];

   // Hash function for endpoint
   const getHashKey = (item: any) => {
	   const str = `${item.name || ''}_${item.hostName || ''}_${item.probePort || ''}_${item.probeType || ''}`;
	   return getStableHash(str);
   };

   const rows = data.Attr
	   ? (() => {
		   const sorted = [...data.Attr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map(item => {
			   return {
				   id: getHashKey(item),
				   name: item.name,
				   hostName: item.hostName,
				   inactiveReTries: item.inactiveReTries,
				   probeType: item.probeType,
				   currState: item.currState,
				   probeDuration: item.probeDuration,
				   probePort: item.probePort,
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'Endpoint'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} onEdit={onUpdate} onRefresh={onRefresh} state={state} error={error} />;
}
