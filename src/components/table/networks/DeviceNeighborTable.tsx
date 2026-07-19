//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {INeighborData} from 'types/device_neighbor';
import {IDataTableColumnDef} from 'types/global';
import {getStableHash} from 'common';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborTable(props: {data: INeighborData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onRefresh?: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'ipAddress', header: 'IP Address', width: 'wide', tooltip: 'Assigned IP address for routing or interface use.'},
		{data_key: 'macAddress', header: 'MAC Address', width: 'wide', tooltip: 'Assigned MAC address for routing or interface use.'},
		{data_key: 'dev', header: 'Interface', width: 'wide'},
	];

   // Use global hash function for Device Neighbor entry
	const getHashKey = (item: any) => getStableHash(`${item.dev || ''}_${item.ipAddress || ''}`);

	const rows = data.neighborAttr && Array.isArray(data.neighborAttr)
		? (() => {
			const sorted = [...data.neighborAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
			return sorted.map((item, index) => ({
				id: index,
				dev: item.dev,
				ipAddress: item.ipAddress,
				macAddress: item.macAddress,
				_uniqueKey: getHashKey(item),
			}));
		})()
		: [];

	return (
		<DataTable
			name={'Device Neighbor'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			error={error}
		/>
	);
}
