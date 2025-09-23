//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import { IIpAttribute, IIpAttributeInput } from 'types/ip';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipv4_all(instance: IInstance): Promise<IIpAttribute[]> {
	const resp = await GET_INST(instance, `/config/ipv4address/all`);
	return (resp.data?.ipAttr as IIpAttribute[]) ?? [];
}

export async function request_create_ipv4(instance: IInstance, data: IIpAttributeInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipv4address`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'IP Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_ipv4(instance: IInstance, ip: string, mask: number, dev: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ipv4address/${ip}/${mask}/dev/${dev}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'IP Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
