//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IBgpNeighborState} from 'types/bgp_neighbor';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPNeighborTable(props: {data: IBgpNeighborState; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'ipAddress', header: 'IP Address', width: 'wide', tooltip: 'Assigned IP address for routing or interface use.'},
		{
			data_key: 'remoteAs',
			header: 'Remote AS',
			width: 'wide',
			tooltip: 'Autonomous System (AS) numbers used between BGP neighbors',
		},
		{data_key: 'state', header: 'State', type: 'state', width: 'wide', tooltip: 'Indicates whether the component or service is active or inactive.'},
		{data_key: 'updowntime', header: 'Up(Down) Time', align: 'right', width: 'wide'},
	];

	const rows = data.bgpNeiAttr.map(item => {
		return {
			id: getStableHash(String(item.ipAddress ?? '')),
			ipAddress: item.ipAddress,
			remoteAs: item.remoteAs,
			state: item.state,
			updowntime: item.updowntime,
		};
	});

	return (
		<DataTable name={'BGP Neighbor'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} error={error} />
	);
}
