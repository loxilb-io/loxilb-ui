//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IEndpoint} from 'types/load_balancer';
import ep_roles from 'assets/json/ep_roles.json';

//---------------------------------------------------------
// Helpers
//---------------------------------------------------------
// Same catalog the Add/Edit form uses (0 normal, 1 prefill, 2 decode); an
// unknown id falls back to the raw number rather than hiding the value.
export const epRoleLabel = (role?: number | null): string | undefined => {
	if (role === undefined || role === null) return undefined;
	return ep_roles.find(r => r.send_value === role)?.name ?? String(role);
};

// The gateway only returns ep_role/nixl_port on AI-gateway (P/D
// disaggregation) rules; keep the plain-L4 table free of empty columns.
export const hasPdFields = (data?: IEndpoint[]): boolean => (data ?? []).some(item => item.ep_role !== undefined || item.nixl_port !== undefined);

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBEndpointTable(props: {data: IEndpoint[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const has_pd_fields = hasPdFields(data);

	const cols: IDataTableColumnDef[] = [
		{data_key: 'endpointIP', header: 'Endpoint IP', width: 'wide', type: 'mono'},
		{data_key: 'targetPort', header: 'Target Port', width: 'medium', align: 'right', type: 'mono'},
		{data_key: 'weight', header: 'Weight', width: 'medium', align: 'right', type: 'mono'},
		...(has_pd_fields
			? ([
					{data_key: 'ep_role', header: 'Role', width: 'medium', type: 'tag', tooltip: 'Prefill/decode role of this endpoint under P/D disaggregation'},
					{data_key: 'nixl_port', header: 'NIXL Port', width: 'medium', align: 'right', type: 'mono', tooltip: 'NIXL side-channel port for KV-cache transfer; "–" means the target port is used'},
			  ] as IDataTableColumnDef[])
			: []),
		{data_key: 'state', header: 'State', type: 'state', width: 'medium'},
		{data_key: 'counter', header: 'Counter', width: 'wide', type: 'mono'},
	];

	const getUniqueKey = (item: any) => {
		return [
			item.endpointIP || '',
			item.targetPort || ''
		].join('-');
	};

	const rows = data
		? [...data]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => {
				return {
					id: index,
					endpointIP: item.endpointIP,
					weight: item.weight,
					targetPort: item.targetPort,
					ep_role: epRoleLabel(item.ep_role),
					// 0 = "use targetPort" (gateway default) — shown as "–"
					nixl_port: item.nixl_port ? item.nixl_port : undefined,
					state: item.state,
					counter: item.counter,
				};
			})
		: undefined

	return <DataTable name={'Load Balancer Endpoint'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} hideCheckbox={true} />;
}
