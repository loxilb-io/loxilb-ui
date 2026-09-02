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
export async function query_get_neighbor_all(instance: IInstance): Promise<GwSchema<'NeighborEntry'>[]> {
	const resp = await GET_INST<GwGetResp<'/config/neighbor/all'>>(instance, `/config/neighbor/all`);
	assertOk(resp, 'Get Neighbor');
	return resp.data?.neighborAttr ?? [];
}

export async function request_create_device_neighbor(instance: IInstance, data: any): Promise<OpResult> {
	return runOp('device_neghbors.create_device_neighbor', () => POST_INST(instance, `/config/neighbor`, data));
}

export async function request_delete_device_neighbor(instance: IInstance, ip: string, dev: string): Promise<OpResult> {
	return runOp('device_neghbors.delete_device_neighbor', () => DELETE_INST(instance, `/config/neighbor/${ip}/dev/${dev}`));
}
