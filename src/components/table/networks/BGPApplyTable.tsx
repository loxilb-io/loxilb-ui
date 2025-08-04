//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPApplyTable(props: {data: any[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'neighborIP', header: 'Neighbor IP'},
		{data_key: 'policyType', header: 'Policy Type'},
		{data_key: 'polices', header: 'Policy List', width: 'wide'},
		{data_key: 'routeAction', header: 'Route Action', width: 'full'},
	];

	const rows = data.map((item, index) => {
		return {
			id: index,
			neighborIP: item.neighborIP,
			policyType: item.policyType,
			polices: item.polices.join(', '),
			routeAction: item.routeAction.join(', '),
		};
	});

	return <DataTable name={'BGP Apply'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} />;
}
