//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDefinedSetsInfo} from 'types/bgp_defined_set';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinedSetTable(props: {data: IDefinedSetsInfo; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'wide'},
		{data_key: 'prefixList', header: 'Prefix List', width: 'wide', tooltip: 'Prefix List for Subnet'},
		{data_key: 'neighbor', header: 'Neighbor'},
		{data_key: 'community', header: 'Community'},
		{data_key: 'extcommunity', header: 'ExtCommunity'},
		{data_key: 'aspath', header: 'AS Path'},
		{data_key: 'largecommunity', header: 'LargeCommunity'},
	];

	// Group data by name
	const groupedData = data.definedsetsAttr.reduce((acc, item) => {
		if (!acc[item.name]) {
			acc[item.name] = [];
		}
		acc[item.name].push(item);
		return acc;
	}, {} as Record<string, typeof data.definedsetsAttr>);

	// Create rows from grouped data
	const rows = Object.entries(groupedData).map(([name, items], index) => {
		return {
			id: index,
			name,
			prefixList:
				items
					.filter(item => item.prefixList && item.prefixList.length > 0)
					.flatMap(item =>
						item.prefixList.map(prefix => (prefix.masklengthRange ? `${prefix.ipPrefix} (${prefix.masklengthRange.replace('..', '-')})` : prefix.ipPrefix)),
					)
					.join(', ') || undefined,
			neighbor:
				items
					.filter(item => item.definedType === 'neighbor')
					.flatMap(item => item.list)
					.join(', ') || undefined,
			community:
				items
					.filter(item => item.definedType === 'community')
					.flatMap(item => item.list)
					.join(', ') || undefined,
			extcommunity:
				items
					.filter(item => item.definedType === 'extcommunity')
					.flatMap(item => item.list)
					.join(', ') || undefined,
			aspath:
				items
					.filter(item => item.definedType === 'aspath')
					.flatMap(item => item.list)
					.join(', ') || undefined,
			largecommunity:
				items
					.filter(item => item.definedType === 'largecommunity')
					.flatMap(item => item.list)
					.join(', ') || undefined,
		};
	});

	return <DataTable name="Defined Set" columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />;
}
