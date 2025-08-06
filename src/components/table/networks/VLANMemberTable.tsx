//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IMember} from 'types/vlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VLANMemberTable(props: {data: IMember[]; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Device', width: 'wide'},
		{data_key: 'tag', header: 'Tagged', width: 'medium'},
	];

   // Hash function for VLAN member
   const getHashKey = (item: IMember) => {
	   const str = `${item.dev || ''}_${item.tagged ? 'tagged' : 'untagged'}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };
   const sorted = data ? [...data].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   const rows: any[] = sorted.map((item, index) => {
	   return {
		   id: index,
		   dev: item.dev,
		   tag: item.tagged ? 'Yes' : 'No',
		   _uniqueKey: getHashKey(item),
	   };
   });

	return (
		<DataTable name={'VLAN Member'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />
	);
}
