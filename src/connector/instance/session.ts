//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {ISessionAttribute} from 'types/session';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_session_all(instance: IInstance): Promise<ISessionAttribute[]> {
	const resp = await GET_INST(instance, `/config/session/all`);
	return (resp.data?.sessionAttr as ISessionAttribute[]) ?? [];
}

export async function request_create_session(instance: IInstance, data: ISessionAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/session`, data);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_delete_session(instance: IInstance, ident: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/session/ident/${ident}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}
