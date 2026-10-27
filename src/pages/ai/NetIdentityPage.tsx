//---------------------------------------------------------
// Network identities page (gateway 9f5017e2) — read-only
//---------------------------------------------------------
// A binding attributes requests from a network to a tenant. The UI lists them
// as stored; they are created and removed with loxicmd or the API.
//
// What a binding is NOT, said on the page: a cidr match says where a request
// came from, not who sent it; an IPsec tunnel name is the interface the
// gateway matches on, not a statement that the tunnel is up.

import {Alert} from '@mui/material';
import {getStableHash} from 'common';
import {PageDataState, toPageState} from 'components/state/pageState';
import DataTable from 'components/table/DataTable';
import {INetIdentityEntry, NETIDENTITY_ROUTE_MISSING} from 'connector/instance/ai_objective';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useNetIdentities} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import React, {Fragment} from 'react';
import {IDataTableColumnDef} from 'types/global';

/** The read state, with a route 404 named for what it is. */
export function netIdentityPageState(state: PageDataState<INetIdentityEntry[]>): PageDataState<INetIdentityEntry[]> {
	if (state.kind === 'failed' && state.result.httpStatus === 404) {
		return {...state, result: {...state.result, localeKey: NETIDENTITY_ROUTE_MISSING, retryable: false}};
	}
	return state;
}

/** The one source a binding matches, in words. */
export function describeMatch(match: INetIdentityEntry['match']): string {
	if (!match) return '–';
	if (match.cidr && match.cidr.length > 0) return t('Source {{cidr}}', {cidr: match.cidr.join(', ')});
	if (match.ingress_if) return t('Interface {{name}}', {name: match.ingress_if});
	if (match.vlan !== undefined && match.vlan !== null) return t('VLAN {{id}}', {id: match.vlan});
	if (match.vni !== undefined && match.vni !== null) return t('VNI {{id}}', {id: match.vni});
	if (match.ipsec_tunnel) return t('IPsec tunnel {{name}} (its interface)', {name: match.ipsec_tunnel});
	return '–';
}

const list = (values: readonly string[] | null | undefined, empty: string): string => ((values ?? []).length > 0 ? (values ?? []).join(', ') : empty);

export default function NetIdentityPage() {
	const inst = useInstanceFromURL();
	const query = useNetIdentities(inst);
	const {data, refetch} = query;
	const bindings = React.useMemo(() => (Array.isArray(data) ? data : []), [data]);
	const state = netIdentityPageState(toPageState(query, {op: 'ai_netidentity.list'}));

	const cols: IDataTableColumnDef[] = [
		{data_key: 'name', header: 'Name', width: 'medium', type: 'mono'},
		{data_key: 'tenant', header: 'Tenant', width: 'medium', type: 'mono'},
		{data_key: 'match', header: 'Match', width: 'wide', type: 'mono', tooltip: 'A cidr match says where a request came from, not who sent it. An interface match is as strong as the network boundary behind it.'},
		{data_key: 'services', header: 'Services', width: 'wide', type: 'mono'},
		{data_key: 'credential', header: 'Credential', width: 'narrow', tooltip: 'network: on a service that requires a credential, a request without one is admitted as the binding\'s tenant (interface matches only).'},
		{data_key: 'enforce', header: 'Enforce', width: 'narrow', tooltip: 'strict refuses a credential of another tenant with 403.'},
		{data_key: 'fail_mode', header: 'Fail mode', width: 'narrow', tooltip: 'What the binding\'s services do while the binding lookup cannot answer.'},
		{data_key: 'forward_identity', header: 'Forward identity', width: 'narrow'},
		{data_key: 'allowed_models', header: 'Allowed models', width: 'medium', type: 'mono'},
		{data_key: 'priority_class', header: 'Priority class', width: 'narrow', tooltip: 'The highest class the binding\'s requests may have; it can only lower what the tenant allows.'},
	];

	const rows = bindings.map(binding => ({
		id: getStableHash(binding.name ?? ''),
		name: binding.name ?? '',
		tenant: binding.tenant ?? '',
		match: describeMatch(binding.match),
		services: list(binding.services, t('All AI services')),
		credential: binding.credential ?? t('none (default)'),
		enforce: binding.enforce ?? t('advisory (default)'),
		fail_mode: binding.fail_mode ?? t('neutral (default)'),
		forward_identity: binding.forward_identity ? t('Yes') : t('No'),
		allowed_models: list(binding.allowed_models, t('Any')),
		// The binding's default is standard, unlike a key's "no cap".
		priority_class: binding.priority_class ?? t('standard (default)'),
	}));

	return (
		<Fragment>
			<Alert severity="info" sx={{mb: 2}}>
				{t('Network identities attribute requests from a network to a tenant, for limits, fairness and records. They never replace a credential. Bindings are created and removed with loxicmd or the API; this list is read-only.')}
			</Alert>
			<DataTable name={'Network Identities'} columns={cols} rows={rows} selected_rows={[]} onChangeSelectedRows={() => undefined} hideCheckbox disableSelect onRefresh={() => void refetch()} state={state} />
		</Fragment>
	);
}
