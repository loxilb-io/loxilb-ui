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
export default function IPTable(props: {data: IIpData; title?: string; selected_rows: number[]; onChangeSelectedRows: any; onDelete: any; onUpdate?: any; onRefresh?: any; error?: boolean}) {
	const {data, title, selected_rows, onChangeSelectedRows, onDelete, onUpdate, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'ipAddress', header: 'IP Addresses', width: 'super_wide', tooltip: 'Assigned IP Addresses'},
		{data_key: 'dev', header: 'Device', width: 'wide', tooltip: 'Device (Interface Name)'},		
		{data_key: 'sync', header: 'Synced', width: 'medium', tooltip: 'Synced with the IP address', type: 'sync'},
	];

   // Use global hash function for IP entry
   const getHashKey = (item: any) => getStableHash(`${item.dev || ''}_${item.ipAddress.join(', ') || ''}`);

   // Use data as provided (already sorted by parent component)
   const rows = data.ipAttr
	   ? data.ipAttr.map((item, index) => ({
		   id: index,
		   dev: item.dev,
		   ipAddress: item.ipAddress.join(', '),
		   sync: item.sync,
		   _uniqueKey: getHashKey(item),
	   }))
	   : undefined;

	return (
		<DataTable
			name={title ?? 'IP Address'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onEdit={onUpdate}
			onDelete={onDelete}
			onRefresh={onRefresh}
			hideIdColumn={false}
			defaultSort={{field: 'dev', sort: 'asc'}}
			error={error}
		/>
	);
}
