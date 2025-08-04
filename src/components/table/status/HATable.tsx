//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IVipConfiguration} from 'types/ha';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HATable(props: {data: IVipConfiguration; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'instance', header: 'Instance', width: 'wide', tooltip: 'Name of the instance LoxiLB is running on'},
		{data_key: 'vip', header: 'Virtual IP', width: 'wide', tooltip: 'Virtual IP for HA (Active/Stanby)'},
		{data_key: 'state', header: 'State', width: 'medium', tooltip: 'State for HA'},
		{data_key: 'sync', header: 'Sync', type: 'state', width: 'medium', tooltip: 'Synchronizing'},
	];

	const rows = data.Attr.map((item, index) => {
		return {
			id: index,
			instance: item.instance,
			vip: item.vip,
			state: item.state,
			sync: item.sync ?? true,
		};
	});

	return <DataTable name={'High Availability'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} />;
}
