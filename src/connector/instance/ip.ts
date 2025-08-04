//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IIpAttribute, IIpAttributeInput} from 'types/ip';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipv4_all(instance: IInstance): Promise<IIpAttribute[]> {
	const resp = await GET_INST(instance, `/config/ipv4address/all`);
	return (resp.data?.ipAttr as IIpAttribute[]) ?? [];
}

export async function request_create_ipv4(instance: IInstance, data: IIpAttributeInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipv4address`, data);
	if (resp.code !== 200) return {status: 'error', error: `Failed to create IP address: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_ipv4(instance: IInstance, ip: string, mask: number, dev: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ipv4address/${ip}/${mask}/dev/${dev}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete IP address: ${resp.message}`};
	else return {status: 'success'};
}
