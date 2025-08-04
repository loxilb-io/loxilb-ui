//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {INeighborData} from 'types/device_neighbor';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborTable(props: {data: INeighborData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Name', width: 'wide'},
		{data_key: 'ipAddress', header: 'IP Address', width: 'wide', tooltip: 'Assigned IP address for routing or interface use.'},
		{data_key: 'macAddress', header: 'MAC Address', width: 'wide', tooltip: 'Assigned MAC address for routing or interface use.'},
	];

	const rows = data.neighborAttr.map((item, index) => {
		return {
			id: index,
			ipAddress: item.ipAddress,
			dev: item.dev,
			macAddress: item.macAddress,
		};
	});

	return (
		<DataTable
			name={'Device Neighbor'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
		/>
	);
}
