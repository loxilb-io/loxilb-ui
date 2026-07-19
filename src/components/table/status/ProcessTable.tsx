//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IProcessInfo} from 'types/process';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ProcessTable(props: {data: IProcessInfo; selected_rows: number[]; onChangeSelectedRows: any; onRefresh?: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'pid', header: 'PID', tooltip: 'Process ID', width: 'medium'},
		{data_key: 'user', header: 'User', width: 'wide'},
		{data_key: 'command', header: 'Command', width: 'wide', tooltip: 'Process name'},
		{data_key: 'status', header: 'Status', type: 'status'},
		{data_key: 'CPUUsage', header: 'CPU (%)', align: 'right', width: 'medium', tooltip: 'CPU Utilization(%)'},
		{data_key: 'MemoryUsage', header: 'Memory (%)', align: 'right', width: 'medium', tooltip: 'Memory Utilization(%)'},
		{data_key: 'time', header: 'Runtime', align: 'right', width: 'wide'},
	];

	const rows = data.processAttr.map((item, index) => {
		return {
			id: index,
			status: item.status,
			pid: item.pid,
			user: item.user,
			command: item.command,
			CPUUsage: item.CPUUsage,
			MemoryUsage: item.MemoryUsage,
			time: item.time,
		};
	});

	return <DataTable name={'Process'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onRefresh={onRefresh} error={error} />;
}
