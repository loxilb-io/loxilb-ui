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

	const rows: any[] = data.map((item, index) => {
		return {
			id: index,
			dev: item.dev,
			tag: item.tagged ? 'Yes' : 'No',
		};
	});

	return (
		<DataTable name={'VLAN Member'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />
	);
}
