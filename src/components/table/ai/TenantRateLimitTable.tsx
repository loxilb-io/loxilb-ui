//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {ITenantRateLimitEntry} from 'types/ai';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TenantRateLimitTable(props: {
	data: ITenantRateLimitEntry[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onEdit?: () => void;
	onRefresh?: () => void;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onEdit, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'tenant_id', header: 'Tenant', width: 'wide'},
		{data_key: 'rps', header: 'RPS', align: 'right', tooltip: 'Maximum requests per second (0 = unlimited)'},
		{data_key: 'tokens_per_min', header: 'Tokens/min', align: 'right', tooltip: 'Maximum LLM tokens per minute (0 = unlimited)'},
		{data_key: 'updated_at', header: 'Updated', width: 'medium', tooltip: 'Timestamp of the last rate limit update'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		tenant_id: item.tenant_id,
		rps: item.rps ?? 0,
		tokens_per_min: item.tokens_per_min ?? 0,
		updated_at: item.updated_at ?? '',
	}));

	return (
		<DataTable
			name={'AI Tenant Rate Limits'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onEdit}
			onRefresh={onRefresh}
			error={error}
			hideCheckbox={true}
		/>
	);
}
