//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IFilesystemInfo} from 'types/filesystem';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FSTable(props: {data: IFilesystemInfo; selected_rows: number[]; onChangeSelectedRows: any; onRefresh?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onRefresh} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'fileSystem', header: 'File System', width: 'wide'},
		{data_key: 'type', header: 'Type', width: 'medium'},
		{data_key: 'size', header: 'Total Size', align: 'left', width: 'medium'},
		{data_key: 'avail', header: 'Free Size', align: 'left', width: 'medium'},
		{data_key: 'usage', header: 'Current Usage', align: 'left', width: 'super_wide', type: 'usage'},
	];

	const getUniqueKey = (item: any) => {
		return [
			item.fileSystem || '',
			item.type || ''
		].join('-');
	};

	const rows = data.filesystemAttr
		? [...data.filesystemAttr]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => {
				return {
					id: index,
					fileSystem: item.fileSystem,
					type: item.type,
					size: item.size,
					avail: item.avail,
					usage: {amount: parseFloat(item.used).toFixed(1), percent: parseFloat(item.usePercent).toFixed(1) + '%'},
				};
			})
		: undefined

	return <DataTable name={'File System'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onRefresh={onRefresh} disableSelect />;
}
