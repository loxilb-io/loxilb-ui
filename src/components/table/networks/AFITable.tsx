//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AFITable(props: {data: string[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'afi', header: 'AFI', type: 'tag', tooltip: 'Address Family Identifier', width: 'wide'},
		{data_key: 'safi', header: 'SAFI', type: 'tag', tooltip: 'Subsequent Address Family Identifier', width: 'wide'},
	];

	const rows = data.map((afiSafi: string, index: number) => {
		return {
			id: index,
			afi: afiSafi.split('-')[0],
			safi: afiSafi.split('-')[1],
		};
	});

	return <DataTable name={'AFI'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} />;
}
