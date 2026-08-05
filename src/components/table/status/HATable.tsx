//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IVipConfiguration} from 'types/ha';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HATable(props: {data: IVipConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onEdit?: any; onRefresh?: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onEdit, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'instance', header: 'Instance', width: 'wide', tooltip: 'Name of the instance LoxiLB is running on'},
		{data_key: 'vip', header: 'Virtual IP', width: 'wide', type: 'mono', tooltip: 'Virtual IP for HA (Active/Stanby)'},
		{data_key: 'state', header: 'State', width: 'medium', type: 'state', tooltip: 'State for HA'},
	];

	const rows = data.Attr.map((item, index) => {
		return {
			id: index,
			instance: item.instance,
			vip: item.vip,
			state: item.state,
		};
	});

	return <DataTable name={'High Availability'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onEdit={onEdit} onRefresh={onRefresh} error={error} />;
}
