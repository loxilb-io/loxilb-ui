//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IEndpoint} from 'types/load_balancer';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBEndpointTable(props: {data: IEndpoint[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'endpointIP', header: 'Endpoint IP', width: 'wide'},
		{data_key: 'targetPort', header: 'Target Port', width: 'medium'},
		{data_key: 'weight', header: 'Weight', width: 'medium'},
		{data_key: 'state', header: 'State', type: 'state', width: 'medium'},
		{data_key: 'counter', header: 'Counter', width: 'wide'},
	];

	const getUniqueKey = (item: any) => {
		return [
			item.endpointIP || '',
			item.targetPort || ''			
		].join('-');
	};

	const rows = data
		? [...data]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => {
				return {
					id: index,
					endpointIP: item.endpointIP,
					weight: item.weight,
					targetPort: item.targetPort,
					state: item.state,
					counter: item.counter,
				};
			})
		: undefined

	return <DataTable name={'Load Balancer Endpoint'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} />;
}
