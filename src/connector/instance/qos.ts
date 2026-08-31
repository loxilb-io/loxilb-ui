//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import {IPolicyAttribute, parseQoSRuleTarget} from 'types/qos';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_qos_policy_all(instance: IInstance): Promise<IPolicyAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/policy/all'>>(instance, `/config/policy/all`);
	assertOk(resp, 'Get QoS');
	return (resp.data?.polAttr ?? []) as IPolicyAttribute[];
}

export async function request_create_qos_policy(instance: IInstance, data: IPolicyAttribute): Promise<OpResult> {
	// Client-side backstop (the form validates inline before this point):
	// a mapped `invalid`, with the field message in diagnostics only.
	if (!data.targetObject.polObjName?.trim()) {
		return {status: 'invalid', code: 'qos.create.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: 'QoS target is required.'};
	}
	if (data.targetObject.attachment === 0 && !parseQoSRuleTarget(data.targetObject.polObjName)) {
		return {status: 'invalid', code: 'qos.create.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: 'A rule-attached QoS policy requires VIP:PORT:PROTO for IPv4 or [VIP]:PORT:PROTO for IPv6.'};
	}

	// The input form's onChange emits its validation state (isValid/errors)
	// alongside the policy fields; build an explicit IPolicyAttribute payload
	// so those client-only keys can never leak into the gateway POST.
	const payload: IPolicyAttribute = {
		policyIdent: data.policyIdent,
		policyInfo: data.policyInfo,
		targetObject: data.targetObject,
	};
	return runOp('qos.create_qos_policy', () => POST_INST(instance, `/config/policy`, payload));
}

export async function request_delete_qos_policy(instance: IInstance, ident: string): Promise<OpResult> {
	return runOp('qos.delete_qos_policy', () => DELETE_INST(instance, `/config/policy/ident/${ident}`));
}
