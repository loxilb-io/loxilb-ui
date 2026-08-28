//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import { IVxlanAttribute, IVxlanInput } from 'types/vxlan';
import {ApiResult, assertOk, createDetailedErrorMessage, isMutationFailure} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_vxlan_all(instance: IInstance): Promise<IVxlanAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/tunnel/vxlan/all'>>(instance, `/config/tunnel/vxlan/all`);
	assertOk(resp, 'Get VXLAN');
	return (resp.data?.vxlanAttr ?? []) as IVxlanAttribute[];
}

export async function request_create_vxlan(instance: IInstance, data: IVxlanInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/tunnel/vxlan`, data);
	if (isMutationFailure(resp)) {
		const errorMessage = createDetailedErrorMessage(resp, 'VXLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_vxlan(instance: IInstance, vxlanID: number): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/tunnel/vxlan/${vxlanID}`);
	if (isMutationFailure(resp)) {
		const errorMessage = createDetailedErrorMessage(resp, 'VXLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_add_vxlan_peer(instance: IInstance, vxlanID: number, peerIP: string): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/tunnel/vxlan/${vxlanID}/peer`, {peerIP});
	if (isMutationFailure(resp)) {
		const errorMessage = createDetailedErrorMessage(resp, 'VXLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_vxlan_peer(instance: IInstance, vxlanID: number, peerIP: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/tunnel/vxlan/${vxlanID}/peer/${peerIP}`);
	if (isMutationFailure(resp)) {
		const errorMessage = createDetailedErrorMessage(resp, 'VXLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
