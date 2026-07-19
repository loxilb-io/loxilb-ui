//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {ApiResult, assertOk, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp, GwSchema} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_neighbor_all(instance: IInstance): Promise<GwSchema<'NeighborEntry'>[]> {
	const resp = await GET_INST<GwGetResp<'/config/neighbor/all'>>(instance, `/config/neighbor/all`);
	assertOk(resp, 'Get Neighbor');
	return resp.data?.neighborAttr ?? [];
}

export async function request_create_device_neighbor(instance: IInstance, data: any): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/neighbor`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Device Neighbors Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_device_neighbor(instance: IInstance, ip: string, dev: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/neighbor/${ip}/dev/${dev}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Device Neighbors Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
