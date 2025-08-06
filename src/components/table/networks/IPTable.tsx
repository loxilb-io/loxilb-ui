//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IIpData} from 'types/ip';
import {getStableHash} from 'common';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPTable(props: {data: IIpData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Device', width: 'wide', tooltip: 'Device (Interface Name)'},
		{data_key: 'ipAddress', header: 'IP Addresses', width: 'super_wide', tooltip: 'Assigned IP Addresses'},
		{data_key: 'sync', header: 'Synced', width: 'medium', tooltip: 'Synced with the IP address', type: 'sync'},
	];

   // Use global hash function for IP entry
   const getHashKey = (item: any) => getStableHash(`${item.dev || ''}_${item.ipAddress.join(', ') || ''}`);

   const rows = data.ipAttr
	   ? (() => {
		   const sorted = [...data.ipAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map((item, index) => ({
			   id: index,
			   dev: item.dev,
			   ipAddress: item.ipAddress.join(', '),
			   sync: item.sync,
			   _uniqueKey: getHashKey(item),
		   }));
	   })()
	   : undefined;

	return (
		<DataTable
			name={'IP Address'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			hideIdColumn={false}
			defaultSort={{field: 'dev', sort: 'asc'}}
		/>
	);
}
