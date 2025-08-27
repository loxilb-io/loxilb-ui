//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IFdbData} from 'types/fdb';
import {IDataTableColumnDef} from 'types/global';
import {getStableHash} from 'common';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FDBTable(props: {data: IFdbData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onRefresh?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Device', width: 'wide'},
		{data_key: 'macAddress', header: 'MAC Address', width: 'wide'},
	];

   // Use global hash function for FDB entry
   const getHashKey = (item: any) => getStableHash(`${item.dev || ''}_${item.macAddress || ''}`);

   const rows = data.fdbAttr
	   ? (() => {
		   const sorted = [...data.fdbAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map((item) => {
			   return {
				   id: getHashKey(item),
				   dev: item.dev,
				   macAddress: item.macAddress,
				   description: '',
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return (
		<DataTable
			name={'Forwarding Database'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
		/>
	);
}
