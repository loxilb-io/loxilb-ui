//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import { IVxlanAttribute, IVxlanInput } from 'types/vxlan';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_vxlan_all(instance: IInstance): Promise<IVxlanAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/tunnel/vxlan/all'>>(instance, `/config/tunnel/vxlan/all`);
	assertOk(resp, 'Get VXLAN');
	return (resp.data?.vxlanAttr ?? []) as IVxlanAttribute[];
}

export async function request_create_vxlan(instance: IInstance, data: IVxlanInput): Promise<OpResult> {
	return runOp('vxlan.create_vxlan', () => POST_INST(instance, `/config/tunnel/vxlan`, data));
}

export async function request_delete_vxlan(instance: IInstance, vxlanID: number): Promise<OpResult> {
	return runOp('vxlan.delete_vxlan', () => DELETE_INST(instance, `/config/tunnel/vxlan/${vxlanID}`));
}

export async function request_add_vxlan_peer(instance: IInstance, vxlanID: number, peerIP: string): Promise<OpResult> {
	return runOp('vxlan.add_vxlan_peer', () => POST_INST(instance, `/config/tunnel/vxlan/${vxlanID}/peer`, {peerIP}));
}

export async function request_delete_vxlan_peer(instance: IInstance, vxlanID: number, peerIP: string): Promise<OpResult> {
	return runOp('vxlan.delete_vxlan_peer', () => DELETE_INST(instance, `/config/tunnel/vxlan/${vxlanID}/peer/${peerIP}`));
}
