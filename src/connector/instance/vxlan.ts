//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {IVxlanAttribute, IVxlanInput} from 'types/vxlan';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_vxlan_all(instance: IInstance): Promise<IVxlanAttribute[]> {
	const resp = await GET_INST(instance, `/config/tunnel/vxlan/all`);
	return (resp.data?.vxlanAttr as IVxlanAttribute[]) ?? [];
}

export async function request_create_vxlan(instance: IInstance, data: IVxlanInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/tunnel/vxlan`, data);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_delete_vxlan(instance: IInstance, vxlanID: number): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/tunnel/vxlan/${vxlanID}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_add_vxlan_peer(instance: IInstance, vxlanID: number, peerIP: string): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/tunnel/vxlan/${vxlanID}/peer`, {peerIP});
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}

export async function request_delete_vxlan_peer(instance: IInstance, vxlanID: number, peerIP: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/tunnel/vxlan/${vxlanID}/peer/${peerIP}`);
	if (resp.code !== 200 && resp.code !== 204) return {status: 'error', error: resp.data || resp.message};
	else return {status: 'success'};
}
