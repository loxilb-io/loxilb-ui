//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_bgp_defined_sets, query_get_bgp_neighbors, query_get_bgp_policy_definitions} from 'connector/instance/bgp';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function useBGPNeighbors(instance: IInstance | null) {
	return useQueryInstanceData(['bgp_neighbors'], query_get_bgp_neighbors, instance);
}

export function useBGPDefinedSets(instance: IInstance | null, definesetType: 'prefix' | 'neighbor' | 'aspath' | 'community' | 'extcommunity' | 'largecommunity') {
	return useQueryInstanceData(['bgp_defined_sets'], async () => query_get_bgp_defined_sets(instance!, definesetType), instance);
}

export function useBGPPolicyDefs(instance: IInstance | null) {
	return useQueryInstanceData(['bgp_policy_defs'], query_get_bgp_policy_definitions, instance);
}
