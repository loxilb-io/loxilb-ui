//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {IPolicyAttribute} from 'types/qos';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_qos_policy_all(instance: IInstance): Promise<IPolicyAttribute[]> {
	const resp = await GET_INST(instance, `/config/policy/all`);
	return (resp.data?.polAttr as IPolicyAttribute[]) ?? [];
}

export async function request_create_qos_policy(instance: IInstance, data: IPolicyAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/policy`, data);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_delete_qos_policy(instance: IInstance, ident: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/policy/ident/${ident}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}
