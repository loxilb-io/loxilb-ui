//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import {ApiResult, assertOk, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import { IMirrorAttribute } from 'types/mirror';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_mirror_all(instance: IInstance): Promise<IMirrorAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/mirror/all'>>(instance, `/config/mirror/all`);
	assertOk(resp, 'Get Mirror');
	return (resp.data?.mirrAttr ?? []) as IMirrorAttribute[];
}

export async function request_create_mirror(instance: IInstance, data: IMirrorAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/mirror`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Mirror Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_mirror_by_ident(instance: IInstance, ident: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/mirror/ident/${ident}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Mirror Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
