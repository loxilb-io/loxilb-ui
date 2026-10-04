//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { IInstance } from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import { IMirrorAttribute } from 'types/mirror';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_mirror_all(instance: IInstance): Promise<IMirrorAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/mirror/all'>>(instance, `/config/mirror/all`);
	assertOk(resp, 'Get Mirror');
	return (resp.data?.mirrAttr ?? []) as IMirrorAttribute[];
}

export async function request_create_mirror(instance: IInstance, data: IMirrorAttribute): Promise<OpResult> {
	return runOp('mirror.create_mirror', () => POST_INST(instance, `/config/mirror`, data));
}

export async function request_delete_mirror_by_ident(instance: IInstance, ident: string): Promise<OpResult> {
	return runOp('mirror.delete_mirror_by_ident', () => DELETE_INST(instance, `/config/mirror/ident/${ident}`));
}
