//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {INeighborAttr} from 'types/device_neighbor';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_neighbor_all(instance: IInstance): Promise<INeighborAttr[]> {
	const resp = await GET_INST(instance, `/config/neighbor/all`);
	return (resp.data?.neighborAttr as INeighborAttr[]) ?? [];
}

export async function request_create_device_neighbor(instance: IInstance, data: INeighborAttr): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/neighbor`, data);
	if (resp.code !== 200) return {status: 'error', error: `Failed to create neighbor: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_device_neighbor(instance: IInstance, ip: string, dev: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/neighbor/${ip}/dev/${dev}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete neighbor: ${resp.message}`};
	else return {status: 'success'};
}
