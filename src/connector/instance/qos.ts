//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import { IPolicyAttribute } from 'types/qos';
import {ApiResult, assertOk, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_qos_policy_all(instance: IInstance): Promise<IPolicyAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/policy/all'>>(instance, `/config/policy/all`);
	assertOk(resp, 'Get QoS');
	return (resp.data?.polAttr ?? []) as IPolicyAttribute[];
}

export async function request_create_qos_policy(instance: IInstance, data: IPolicyAttribute): Promise<ApiResult> {
	// The input form's onChange emits its validation state (isValid/errors)
	// alongside the policy fields; build an explicit IPolicyAttribute payload
	// so those client-only keys can never leak into the gateway POST.
	const payload: IPolicyAttribute = {
		policyIdent: data.policyIdent,
		policyInfo: data.policyInfo,
		targetObject: data.targetObject,
	};
	const resp = await POST_INST(instance, `/config/policy`, payload);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'QoS Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_qos_policy(instance: IInstance, ident: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/policy/ident/${ident}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'QoS Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
