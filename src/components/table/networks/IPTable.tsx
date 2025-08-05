//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IIpData} from 'types/ip';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPTable(props: {data: IIpData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Device', width: 'wide', tooltip: 'Device (Interface Name)'},
		{data_key: 'ipAddress', header: 'IP Addresses', width: 'super_wide', tooltip: 'Assigned IP Addresses'},
		{data_key: 'sync', header: 'Synced', width: 'medium', tooltip: 'Synced with the IP address', type: 'sync'},
	];

	const getUniqueKey = (item: any) => {
		return [
			item.dev || '',
			item.ipAddress.join(', ') || ''
		].join('-');
	};

	const rows = data.ipAttr
		? [...data.ipAttr]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => ({
				id: index,
				dev: item.dev,
				ipAddress: item.ipAddress.join(', '),
				sync: item.sync,
			}))
		: undefined;

	return (
		<DataTable
			name={'IP Address'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			hideIdColumn={true}
			defaultSort={{field: 'dev', sort: 'asc'}}
		/>
	);
}
