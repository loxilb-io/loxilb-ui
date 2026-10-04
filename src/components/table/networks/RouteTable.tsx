//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_transfer_amount_str, getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IRouteData} from 'types/route_attr';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RouteTable(props: {data: IRouteData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onRefresh?: any; state?: PageDataState<unknown>; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'destinationIPNet', header: 'CIDR', width: 'wide', type: 'mono'},
		{data_key: 'gateway', header: 'Gateway', type: 'mono'},
		{data_key: 'hardwareMark', header: 'Hardware Mark', align: 'right', type: 'mono', tooltip: 'A tag for traffic classification/handling and a key player in hardware-level policies'},
		{data_key: 'protocol', header: 'Protocol', type: 'tag', tooltip: 'Routing Protocol'},
		{data_key: 'flags', header: 'Flags', tooltip: 'Status information or hints of routing policies for specific routes.'},
		{data_key: 'usages', header: 'Usages', type: 'multi-line', align: 'right', width: 'medium'},
	];

   // Use global hash function for Route entry
   const getHashKey = (item: any) => getStableHash(`${item.destinationIPNet || ''}`);

   const rows = data.routeAttr && Array.isArray(data.routeAttr)
	   ? (() => {
		   const sorted = [...data.routeAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
			return sorted.map(item => ({
			   id: getHashKey(item),
			   destinationIPNet: item.destinationIPNet,
			   gateway: item.gateway,
			   hardwareMark: item.hardwareMark,
			   protocol: item.protocol,
			   flags: item.flags,
			   usages: get_transfer_amount_str(item.statistic.bytes, item.statistic.packets),
			   _uniqueKey: getHashKey(item),
		   }));
	   })()
	   : [];

	return (
		<DataTable
			name={'Route'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			hideIdColumn={true}
			defaultSort={{field: 'destinationIPNet', sort: 'asc'}}
			state={state}
			error={error}
		/>
	);
}
