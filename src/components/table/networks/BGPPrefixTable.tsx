//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {useState} from 'react';
import {IPrefixListItem} from 'types/bgp_defined_set';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPPrefixTable(props: {data: IPrefixListItem[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	const cols: IDataTableColumnDef[] = [
		{data_key: 'ipPrefix', header: 'IP Prefix', width: 'wide', type: 'mono'},
		{data_key: 'masklengthRange', header: 'Mask Length Range', width: 'wide', type: 'mono'},
	];

	const rows = data.map((item, index) => {
		return {
			id: index,
			ipPrefix: item.ipPrefix,
			masklengthRange: item.masklengthRange,
		};
	});

	return <DataTable name={'Prefix'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}
