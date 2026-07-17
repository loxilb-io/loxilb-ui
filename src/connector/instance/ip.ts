//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import { IIpAttribute, IIpAttributeInput } from 'types/ip';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipv4_all(instance: IInstance): Promise<IIpAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/ipv4address/all'>>(instance, `/config/ipv4address/all`);
	return (resp.data?.ipAttr ?? []) as IIpAttribute[];
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

// IPv6 — same entry shapes as ipv4 (dev + ipAddress / GET returns ipAttr[])
export async function query_get_ipv6_all(instance: IInstance): Promise<IIpAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/ipv6address/all'>>(instance, `/config/ipv6address/all`);
	return (resp.data?.ipAttr ?? []) as IIpAttribute[];
}

export async function request_create_ipv6(instance: IInstance, data: IIpAttributeInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipv6address`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPv6 Operation')};
	}
	return {status: 'success'};
}

export async function request_delete_ipv6(instance: IInstance, ip: string, mask: number, dev: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ipv6address/${encodeURIComponent(ip)}/${mask}/dev/${dev}`);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPv6 Operation')};
	}
	return {status: 'success'};
}
