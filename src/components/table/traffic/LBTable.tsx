//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import modes from 'assets/json/modes.json';
import sels from 'assets/json/sels.json';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef, IEnumItem} from 'types/global';
import {ILBData} from 'types/load_balancer';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBTable(props: {data: ILBData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const sel_list: IEnumItem[] = sels;
	const mode_list: IEnumItem[] = modes;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'externalIP', header: 'External IP', width: 'wide'},
		{data_key: 'port', header: 'Port'},
		{data_key: 'protocol', header: 'Protocol'},
		{data_key: 'name', header: 'Service Name', width: 'wide'},
		{data_key: 'mark', header: 'Mark'},
		{data_key: 'sel', header: 'Sel'},
		{data_key: 'mode', header: 'Mode'},
		{data_key: 'probeTimeout', header: 'Timeout'},
		{data_key: 'monitor', header: 'Monitor'},
		{data_key: 'endpoints', header: 'Endpoints', width: 'wide'},
	];

	const rows = data.lbAttr.map((item, index) => {
		const mark = item.serviceArguments.block ?? 0;
		const timeout = item.serviceArguments.probeTimeout ?? 1800;

		const sel = item.serviceArguments.sel ?? -1;
		const mode = item.serviceArguments.mode ?? -1;

		const sel_value = sel_list.find(item => item.id === sel)?.send_value || '';
		const mode_value = mode_list.find(item => item.id === mode)?.send_value || '';

		return {
			id: index,
			externalIP: item.serviceArguments.externalIP,
			port: item.serviceArguments.port,
			protocol: item.serviceArguments.protocol,
			name: item.serviceArguments.name,
			mark: mark,
			sel: sel_value,
			mode: mode_value,
			probeTimeout: timeout,
			monitor: item.serviceArguments.monitor ? 'Enabled' : 'Disabled',
			endpoints: item.endpoints.length,
		};
	});

	return (
		<DataTable name={'Load Balancer'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />
	);
}
