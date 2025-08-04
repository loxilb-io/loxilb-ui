//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_transfer_amount_str} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IRouteData} from 'types/route_attr';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RouteTable(props: {data: IRouteData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'destinationIPNet', header: 'CIDR', width: 'wide'},
		{data_key: 'gateway', header: 'Gateway'},
		{data_key: 'hardwareMark', header: 'Hardware Mark', tooltip: 'A tag for traffic classification/handling and a key player in hardware-level policies'},
		{data_key: 'protocol', header: 'Protocol', tooltip: 'Routing Protocol'},
		{data_key: 'flags', header: 'Flags', tooltip: 'Status information or hints of routing policies for specific routes.'},
		{data_key: 'usages', header: 'Usages', type: 'multi-line', align: 'right', width: 'medium'},
	];

	const rows = data.routeAttr.map((item, index) => {
		return {
			id: index,
			destinationIPNet: item.destinationIPNet,
			gateway: item.gateway,
			hardwareMark: item.hardwareMark,
			protocol: item.protocol,
			flags: item.flags,
			usages: get_transfer_amount_str(item.statistic.bytes, item.statistic.packets),
		};
	});

	return (
		<DataTable
			name={'Route'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			hideIdColumn={true}
			defaultSort={{field: 'destinationIPNet', sort: 'asc'}}
		/>
	);
}
