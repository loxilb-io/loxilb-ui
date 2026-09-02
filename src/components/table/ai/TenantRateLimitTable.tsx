//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {ITenantRateLimitEntry} from 'types/ai';
import {PageDataState} from 'components/state/pageState';

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
	state?: PageDataState<unknown>;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onEdit, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'tenant_id', header: 'Tenant', width: 'wide'},
		{data_key: 'rps', header: 'RPS', align: 'right', type: 'mono', tooltip: 'Maximum requests per second (0 = unlimited)'},
		{data_key: 'tokens_per_min', header: 'Tokens/min', align: 'right', type: 'mono', tooltip: 'Maximum LLM tokens per minute (0 = unlimited)'},
		{data_key: 'burst_pct', header: 'Burst', align: 'right', type: 'mono', tooltip: '0 uses the Gateway/process default; positive values are a percent of tokens/min'},
		{data_key: 'model_limits', header: 'Per-model tokens/min', width: 'super_wide', type: 'multi-line', tooltip: 'Model-specific token quotas; 0 removes that model quota'},
		{data_key: 'updated_at', header: 'Updated', width: 'medium', type: 'mono', tooltip: 'Timestamp of the last rate limit update'},
	];

	const rows = data.map(item => ({
		id: getStableHash(String(item.tenant_id ?? '')),
		tenant_id: item.tenant_id,
		rps: item.rps ?? 0,
		tokens_per_min: item.tokens_per_min ?? 0,
		burst_pct: item.burst_pct ? `${item.burst_pct}%` : 'Gateway default',
		model_limits: item.model_limits?.length
			? item.model_limits.map(limit => `${limit.model ?? '(unnamed)'}: ${limit.tokens_per_min ?? 0}`).join('\n')
			: '—',
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
				state={state}
				error={error}
			/>
		);
}
