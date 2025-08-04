//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMirrorAttribute} from 'types/mirror';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_mirror_all(instance: IInstance): Promise<IMirrorAttribute[]> {
	const resp = await GET_INST(instance, `/config/mirror/all`);
	return (resp.data?.mirrAttr as IMirrorAttribute[]) ?? [];
}

export async function request_create_mirror(instance: IInstance, data: IMirrorAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/mirror`, data);
	if (resp.code !== 200) return {status: 'error', error: `Failed to create mirror: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_mirror_by_ident(instance: IInstance, ident: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/mirror/ident/${ident}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete mirror: ${resp.message}`};
	else return {status: 'success'};
}
