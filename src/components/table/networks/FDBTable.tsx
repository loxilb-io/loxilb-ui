//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IFdbData} from 'types/fdb';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FDBTable(props: {data: IFdbData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Device', width: 'wide'},
		{data_key: 'macAddress', header: 'MAC Address', width: 'wide'},
	];

	const getUniqueKey = (item: any) => {
		return [
			item.dev || '',
			item.macAddress || ''
		].join('-');
	};

	const rows = data.fdbAttr
		? [...data.fdbAttr]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => {
				return {
					id: index,
					dev: item.dev,
					macAddress: item.macAddress,
					description: '',
				};
			})
		: undefined

	return (
		<DataTable
			name={'Forwarding Database'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
		/>
	);
}
