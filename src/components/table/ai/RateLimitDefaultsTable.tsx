//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IRateLimitDefaultsEntry} from 'types/ai';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// The rate-limit defaults ladder (Stage 4.2b)
//---------------------------------------------------------
// ⚠️ THIS TABLE CANNOT BE A COMPLETE LIST, and that is a property of the API
// rather than of this page. `GET /config/ai/ratelimit/defaults/rule` without a
// service answers 404 instead of a collection, so there is no read that
// enumerates rule rows. What is shown is the global row plus the services the
// operator has actually asked about — the same "reachable but not enumerable"
// shape the tenant table above has. The page says so in a banner; a bare "No
// rows" here would otherwise read as "no defaults are configured", which this
// read cannot establish for any service it was not asked about.
//
// ⚠️ A zero is rendered as a zero, never as "unlimited". On this endpoint a
// zero field falls through to the next ladder level, so printing "unlimited"
// would assert the opposite of the truth whenever a lower level applies.

export default function RateLimitDefaultsTable(props: {
	data: IRateLimitDefaultsEntry[];
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
		{data_key: 'scope', header: 'Scope', width: 'medium', tooltip: 'global applies everywhere; rule overrides it field by field on one service'},
		{data_key: 'rule_ident', header: 'Service', width: 'wide', tooltip: 'The service a rule row applies to; empty for the global row'},
		{data_key: 'default_user_rps', header: 'User RPS', align: 'right', type: 'mono', tooltip: 'Requests per second for users with no explicit entry; 0 falls through'},
		{data_key: 'default_user_tpm', header: 'User Tokens/min', align: 'right', type: 'mono', tooltip: 'LLM tokens per minute for users with no explicit entry; 0 falls through'},
		{data_key: 'default_tenant_rps', header: 'Tenant RPS', align: 'right', type: 'mono', tooltip: 'Requests per second for tenants with no explicit entry; 0 falls through'},
		{data_key: 'default_tenant_tpm', header: 'Tenant Tokens/min', align: 'right', type: 'mono', tooltip: 'LLM tokens per minute for tenants with no explicit entry; 0 falls through'},
		// ⭐⭐ The two shared-bucket columns carry DIFFERENT tooltips on purpose:
		// the request side bounds keyless traffic only, while the token side is
		// charged by every token-metered response, credentialed included.
		// Wording them alike would understate what the token limit governs.
		{data_key: 'vip_shared_rps', header: 'Shared RPS', align: 'right', type: 'mono', tooltip: 'Requests per second shared by ALL keyless traffic on the service'},
		{data_key: 'vip_shared_tpm', header: 'Shared Tokens/min', align: 'right', type: 'mono', tooltip: "LLM tokens per minute for the service's shared bucket, charged by every token-metered response — credentialed and keyless alike"},
		{data_key: 'updated_at', header: 'Updated', width: 'medium', type: 'mono', tooltip: 'Timestamp of the last update'},
	];

	const rows = data.map(item => ({
		// scope+service is the primary key: the global row and a rule row named
		// "global" are different rows, so neither part alone identifies one.
		id: getStableHash(`${item.scope ?? ''}|${item.rule_ident ?? ''}`),
		scope: item.scope ?? '',
		// An em dash, not an empty cell: the global row has no service by
		// definition, which is different from a service this read failed to get.
		rule_ident: item.rule_ident || '—',
		default_user_rps: item.default_user_rps ?? 0,
		default_user_tpm: item.default_user_tpm ?? 0,
		default_tenant_rps: item.default_tenant_rps ?? 0,
		default_tenant_tpm: item.default_tenant_tpm ?? 0,
		vip_shared_rps: item.vip_shared_rps ?? 0,
		vip_shared_tpm: item.vip_shared_tpm ?? 0,
		updated_at: item.updated_at ?? '',
	}));

	return (
		<DataTable
			name={'AI Rate Limit Defaults'}
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
