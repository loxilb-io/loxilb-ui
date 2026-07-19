//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IApiKeySummary} from 'types/ai';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ApiKeyTable(props: {
	data: IApiKeySummary[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'key_id', header: 'Key ID', width: 'wide'},
		{data_key: 'tenant_id', header: 'Tenant', width: 'medium'},
		{data_key: 'name', header: 'Name', width: 'medium'},
		{data_key: 'allowed_models', header: 'Allowed Models', width: 'wide', tooltip: 'Model identifiers this key may access (empty = all)'},
		{data_key: 'rate_limit_rps', header: 'RPS', align: 'right', tooltip: 'Maximum requests per second (0 = unlimited)'},
		{data_key: 'tokens_per_min', header: 'Tokens/min', align: 'right', tooltip: 'Maximum LLM tokens per minute (0 = unlimited)'},
		{data_key: 'expires_at', header: 'Expires', width: 'medium', tooltip: 'Expiry timestamp (empty = never)'},
		{data_key: 'enabled', header: 'Enabled', type: 'on-off'},
	];

	const rows = data.map((item, index) => ({
		id: index,
		key_id: item.key_id ?? '',
		tenant_id: item.tenant_id ?? '',
		name: item.name ?? '',
		allowed_models: (item.allowed_models ?? []).join(', '),
		rate_limit_rps: item.rate_limit_rps ?? 0,
		tokens_per_min: item.tokens_per_min ?? 0,
		expires_at: item.expires_at ?? '',
		enabled: item.enabled ?? true,
	}));

	return (
		<DataTable
			name={'AI API Keys'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			error={error}
			hideCheckbox={true}
		/>
	);
}
