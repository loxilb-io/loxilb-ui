//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IBFDAttribute, IBfdInput} from 'types/bfd';
import {IInstance} from 'types/oam';
import {ApiResult, assertOk, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_bfd_all(instance: IInstance): Promise<IBFDAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/bfd/all'>>(instance, `/config/bfd/all`);
	assertOk(resp, 'Get BFD');
	return (resp.data?.Attr ?? []) as IBFDAttribute[];
}

export async function request_create_bfd(instance: IInstance, param: IBfdInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/bfd`, param);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'BFD Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_bfd(instance: IInstance, remoteIp: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/bfd/remoteIP/${remoteIp}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'BFD Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
