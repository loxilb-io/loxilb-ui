//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {ISNICertificateListItem} from 'types/security';
import {IDataTableColumnDef} from 'types/global';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SNICertificatesTableProps {
	data: ISNICertificateListItem[];
	selected_rows: number[];
	onChangeSelectedRows: (indices: number[]) => void;
	onAdd?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	state?: PageDataState<unknown>;
	error?: boolean;
}

export default function SNICertificatesTable(props: SNICertificatesTableProps) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'hostname', header: 'Hostname', width: 'wide'},
		{data_key: 'certPath', header: 'Certificate Path', width: 'super_wide', type: 'mono'},
		{data_key: 'refCount', header: 'Reference Count', width: 'medium', align: 'right', type: 'mono'},
	];

	const getHashKey = (item: ISNICertificateListItem) => getStableHash(`${item.hostname}_${item.certPath}`);

	const rows = data.map(item => ({
		id: getHashKey(item),
		hostname: item.hostname,
		certPath: item.certPath,
		refCount: item.refCount.toString(),
	}));

	return (
		<DataTable
			name={'SNI Certificates'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			state={state}
			error={error}
		/>
	);
}
