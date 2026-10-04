//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IUserRateLimitEntry} from 'types/ai';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// A tenant's explicit per-user rate limits (Stage 4.2)
//---------------------------------------------------------
// ⚠️ EVERY ROW HERE IS AN OVERRIDE, and the rows that are absent are the
// point. A user with no explicit entry does not appear — they are governed by
// the configured defaults, then by nothing. So an empty table means "every
// user in this tenant inherits", never "no user is limited", and the page
// says so instead of leaving the usual "No rows" to imply the opposite.
//
// ⚠️ The list endpoint omits model limits; only the per-user read carries
// them. The per-model column therefore reports what this read can know and
// nothing more — it must never be used to build a save body, because the user
// upsert REPLACES the model set and would delete every quota it cannot see.

export default function UserRateLimitTable(props: {
	data: IUserRateLimitEntry[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	onAdd?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	state?: PageDataState<unknown>;
	error?: boolean;
}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onEdit, onDelete, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'user_id', header: 'User', width: 'wide', tooltip: 'The verified identity subject this override applies to'},
		{data_key: 'rps', header: 'RPS', align: 'right', type: 'mono', tooltip: 'Requests per second; 0 falls through to the configured default'},
		{data_key: 'burst_size', header: 'Burst', align: 'right', type: 'mono', tooltip: 'Request burst size; 0 defaults to the requests-per-second value'},
		{data_key: 'tokens_per_min', header: 'Tokens/min', align: 'right', type: 'mono', tooltip: 'LLM tokens per minute; 0 falls through to the configured default'},
		{data_key: 'model_limits', header: 'Per-model tokens/min', width: 'super_wide', type: 'multi-line', tooltip: 'Model-specific token quotas. This list read does not carry them — open the entry to see and edit them'},
		{data_key: 'updated_at', header: 'Updated', width: 'medium', type: 'mono', tooltip: 'Timestamp of the last update'},
	];

	const rows = data.map(item => ({
		// tenant+user is the primary key, so the row identity must include both:
		// keying on user alone would collide across tenants if this table is
		// ever shown for more than one.
		id: getStableHash(`${item.tenant_id ?? ''}|${item.user_id ?? ''}`),
		user_id: item.user_id,
		rps: item.rps ?? 0,
		burst_size: item.burst_size ?? 0,
		tokens_per_min: item.tokens_per_min ?? 0,
		// ⚠️ An em dash, not "none". The list genuinely does not report model
		// limits, so claiming there are none would be a statement this read
		// cannot support.
		model_limits: item.model_limits?.length
			? item.model_limits.map(limit => `${limit.model ?? '(unnamed)'}: ${limit.tokens_per_min ?? 0}`).join('\n')
			: '—',
		updated_at: item.updated_at ?? '',
	}));

	return (
		<DataTable
			name={'AI User Rate Limits'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onEdit={onEdit}
			onDelete={onDelete}
			onRefresh={onRefresh}
			state={state}
			error={error}
		/>
	);
}
