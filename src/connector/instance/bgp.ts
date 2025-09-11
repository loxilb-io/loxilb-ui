//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IBGPDefinedSetInput, IDefinedSetAttribute, IDefinedSetsInfo} from 'types/bgp_defined_set';
import {IBgpNeighborAttribute, IBgpNeighborInput} from 'types/bgp_neighbor';
import {IBgpGlobalConfig, IBgpPolicy, IBgpPolicyApply} from 'types/bgp_policy';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
// Neighbors
export async function query_get_bgp_neighbors(instance: IInstance): Promise<IBgpNeighborAttribute[]> {
	const resp = await GET_INST(instance, `/config/bgp/neigh/all`);
	return (resp.data?.bgpNeiAttr as IBgpNeighborAttribute[]) ?? [];
}

export async function request_create_bgp_neighbor(instance: IInstance, param: IBgpNeighborInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/bgp/neigh`, param);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_delete_bgp_neighbor(instance: IInstance, ipAddress: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/bgp/neigh/${ipAddress}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

// Defined Set
export async function query_get_bgp_defined_sets(
	instance: IInstance,
	definesetType: 'prefix' | 'neighbor' | 'aspath' | 'community' | 'extcommunity' | 'largecommunity',
): Promise<IDefinedSetAttribute[]> {
	const resp = await GET_INST(instance, `/config/bgp/policy/definedsets/${definesetType}/all`);
	return (resp.data?.definedsetsAttr as IDefinedSetAttribute[]) ?? [];
}

export async function request_get_defined_set(
	instance: IInstance,
	definesetType: 'prefix' | 'neighbor' | 'aspath' | 'community' | 'extcommunity' | 'largecommunity',
	typeName: string,
): Promise<IDefinedSetsInfo> {
	const resp = await GET_INST(instance, `/config/bgp/policy/definedsets/${definesetType}/${typeName}`);
	return resp.data as IDefinedSetsInfo;
}

export async function request_create_defined_set(instance: IInstance, param: IBGPDefinedSetInput): Promise<ApiResult> {
	const {definedType, ...body} = param;
	const resp = await POST_INST(instance, `/config/bgp/policy/definedsets/${definedType}`, body);
	if (resp.code !== 200 && resp.code !== 204) {
		return {
			status: 'error',
			error: resp.data || resp.message,
		};
	}
	return {status: 'success'};
}

export async function request_delete_defined_set(
	instance: IInstance,
	definesetType: 'prefix' | 'neighbor' | 'aspath' | 'community' | 'extcommunity' | 'largecommunity',
	typeName: string,
): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/bgp/policy/definedsets/${definesetType}/${typeName}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

// Policy Definitions
export async function query_get_bgp_policy_definitions(instance: IInstance): Promise<IBgpPolicy[]> {
	const resp = await GET_INST(instance, `/config/bgp/policy/definitions/all`);
	return (resp.data?.bgpPolicyAttr as IBgpPolicy[]) ?? [];
}

export async function request_create_bgp_policy_definition(instance: IInstance, param: IBgpPolicy): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/bgp/policy/definitions`, param);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_delete_bgp_policy_definition(instance: IInstance, policyName: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/bgp/policy/definitions/${policyName}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_apply_bgp_policy(instance: IInstance, param: IBgpPolicyApply): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/bgp/policy/apply`, param);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_configure_bgp_global(instance: IInstance, param: IBgpGlobalConfig): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/bgp/global`, param);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}
