//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import { IIpAttribute, IIpAttributeInput } from 'types/ip';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipv4_all(instance: IInstance): Promise<IIpAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/ipv4address/all'>>(instance, `/config/ipv4address/all`);
	assertOk(resp, 'Get IPv4 Address');
	return (resp.data?.ipAttr ?? []) as IIpAttribute[];
}

export async function request_create_ipv4(instance: IInstance, data: IIpAttributeInput): Promise<OpResult> {
	return runOp('ip.create_ipv4', () => POST_INST(instance, `/config/ipv4address`, data));
}

export async function request_delete_ipv4(instance: IInstance, ip: string, mask: number, dev: string): Promise<OpResult> {
	return runOp('ip.delete_ipv4', () => DELETE_INST(instance, `/config/ipv4address/${ip}/${mask}/dev/${dev}`));
}

// IPv6 — same entry shapes as ipv4 (dev + ipAddress / GET returns ipAttr[])
export async function query_get_ipv6_all(instance: IInstance): Promise<IIpAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/ipv6address/all'>>(instance, `/config/ipv6address/all`);
	assertOk(resp, 'Get IPv6 Address');
	return (resp.data?.ipAttr ?? []) as IIpAttribute[];
}

export async function request_create_ipv6(instance: IInstance, data: IIpAttributeInput): Promise<OpResult> {
	return runOp('ip.create_ipv6', () => POST_INST(instance, `/config/ipv6address`, data));
}

export async function request_delete_ipv6(instance: IInstance, ip: string, mask: number, dev: string): Promise<OpResult> {
	return runOp('ip.delete_ipv6', () => DELETE_INST(instance, `/config/ipv6address/${encodeURIComponent(ip)}/${mask}/dev/${dev}`));
}
