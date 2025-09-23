//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFdbAttribute} from 'types/fdb';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_fdb_all(instance: IInstance): Promise<IFdbAttribute[]> {
	const resp = await GET_INST(instance, `/config/fdb/all`);
	return (resp.data?.fdbAttr as IFdbAttribute[]) ?? [];
}

export async function request_create_fdb(instance: IInstance, data: IFdbAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/fdb`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		// Create detailed error message
		const errorMessage = createDetailedErrorMessage(resp, 'Create FDB Entry');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_fdb(instance: IInstance, mac: string, dev: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/fdb/${mac}/dev/${dev}`);
	if (resp.code !== 200 && resp.code !== 204) {
		// Create detailed error message
		const errorMessage = createDetailedErrorMessage(resp, 'Delete FDB Entry');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
