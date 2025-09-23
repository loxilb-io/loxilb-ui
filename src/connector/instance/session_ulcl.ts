//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import { IUlclAttribute } from 'types/session_ulcl';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ulcl_all(instance: IInstance): Promise<IUlclAttribute[]> {
	const resp = await GET_INST(instance, `/config/sessionulcl/all`);
	return (resp.data?.ulclAttr as IUlclAttribute[]) ?? [];
}

export async function request_create_ulcl(instance: IInstance, data: IUlclAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/sessionulcl`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Session ULCL Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_ulcl(instance: IInstance, ident: string, ip: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/sessionulcl/ident/${ident}/ulclAddress/${ip}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Session ULCL Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
