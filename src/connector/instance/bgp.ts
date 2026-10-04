//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp, GwSchema} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
// Neighbors
export async function query_get_bgp_neighbors(instance: IInstance): Promise<GwSchema<'BGPNeighGetEntry'>[]> {
	const resp = await GET_INST<GwGetResp<'/config/bgp/neigh/all'>>(instance, `/config/bgp/neigh/all`);
	assertOk(resp, 'Get BGP Neighbor');
	return resp.data?.bgpNeiAttr ?? [];
}

export async function request_create_bgp_neighbor(instance: IInstance, param: any): Promise<OpResult> {
	return runOp('bgp.create_bgp_neighbor', () => POST_INST(instance, `/config/bgp/neigh`, param));
}

export async function request_delete_bgp_neighbor(instance: IInstance, ipAddress: string): Promise<OpResult> {
	return runOp('bgp.delete_bgp_neighbor', () => DELETE_INST(instance, `/config/bgp/neigh/${ipAddress}`));
}

// Defined Set
export async function query_get_bgp_defined_sets(
	instance: IInstance,
	definesetType: 'prefix' | 'neighbor' | 'aspath' | 'community' | 'extcommunity' | 'largecommunity',
): Promise<GwSchema<'BGPPolicyDefinedSetGetEntry'>[]> {
	// served by the swagger route /config/bgp/policy/definedsets/{defineset_type}/{type_name} with type_name='all'
	const resp = await GET_INST<GwGetResp<'/config/bgp/policy/definedsets/{defineset_type}/{type_name}'>>(instance, `/config/bgp/policy/definedsets/${definesetType}/all`);
	assertOk(resp, 'Get BGP Defined Set');
	return resp.data?.definedsetsAttr ?? [];
}

export async function request_create_defined_set(instance: IInstance, param: any): Promise<OpResult> {
	const {definedType, ...body} = param;
	return runOp('bgp.create_defined_set', () => POST_INST(instance, `/config/bgp/policy/definedsets/${definedType}`, body));
}

export async function request_delete_defined_set(
	instance: IInstance,
	definesetType: 'prefix' | 'neighbor' | 'aspath' | 'community' | 'extcommunity' | 'largecommunity',
	typeName: string,
): Promise<OpResult> {
	return runOp('bgp.delete_defined_set', () => DELETE_INST(instance, `/config/bgp/policy/definedsets/${definesetType}/${typeName}`));
}

// Policy Definitions
export async function query_get_bgp_policy_definitions(instance: IInstance): Promise<GwSchema<'BGPPolicyDefinitionsMod'>[]> {
	const resp = await GET_INST<GwGetResp<'/config/bgp/policy/definitions/all'>>(instance, `/config/bgp/policy/definitions/all`);
	assertOk(resp, 'Get BGP Policy Definition');
	return resp.data?.bgpPolicyAttr ?? [];
}

export async function request_create_bgp_policy_definition(instance: IInstance, param: any): Promise<OpResult> {
	return runOp('bgp.create_bgp_policy_definition', () => POST_INST(instance, `/config/bgp/policy/definitions`, param));
}

export async function request_delete_bgp_policy_definition(instance: IInstance, policyName: string): Promise<OpResult> {
	return runOp('bgp.delete_bgp_policy_definition', () => DELETE_INST(instance, `/config/bgp/policy/definitions/${policyName}`));
}

export async function request_apply_bgp_policy(instance: IInstance, param: any): Promise<OpResult> {
	return runOp('bgp.apply_bgp_policy', () => POST_INST(instance, `/config/bgp/policy/apply`, param));
}

// Remove an applied policy from a neighbor (same body shape as apply)
export async function request_unapply_bgp_policy(instance: IInstance, param: any): Promise<OpResult> {
	return runOp('bgp.unapply_bgp_policy', () => DELETE_INST(instance, `/config/bgp/policy/apply`, param));
}

export async function request_configure_bgp_global(instance: IInstance, param: any): Promise<OpResult> {
	return runOp('bgp.configure_bgp_global', () => POST_INST(instance, `/config/bgp/global`, param));
}
