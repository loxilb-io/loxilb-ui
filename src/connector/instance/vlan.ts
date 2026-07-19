//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import { IVlanAttribute, IVlanInput, IVlanMemberInput } from 'types/vlan';
import {ApiResult, assertOk, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_vlan_all(instance: IInstance): Promise<IVlanAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/vlan/all'>>(instance, `/config/vlan/all`);
	assertOk(resp, 'Get VLAN');

	const raw_list = resp.data?.vlanAttr;
	if (!Array.isArray(raw_list)) return [];
	else
		return raw_list.map(item => ({
			vid: item.vid ?? 0,
			dev: item.dev ?? '',
			member: (item.member ?? []).map(m => ({dev: m.dev ?? '', tagged: m.tagged ?? false})),
			vlanStatistic: {
				inBytes: item.vlanStatistic?.inBytes ?? 0,
				inPackets: item.vlanStatistic?.inPackets ?? 0,
				outBytes: item.vlanStatistic?.outBytes ?? 0,
				outPackets: item.vlanStatistic?.outPackets ?? 0,
			},
		}));
}

export async function request_create_vlan(instance: IInstance, data: IVlanInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/vlan`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'VLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_vlan(instance: IInstance, vid: number): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/vlan/${vid}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'VLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_add_vlan_member(instance: IInstance, vid: number, data: IVlanMemberInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/vlan/${vid}/member`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'VLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_vlan_member(instance: IInstance, vid: number, dev: string, tagged: boolean): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/vlan/${vid}/member/${dev}/tagged/${tagged}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'VLAN Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
