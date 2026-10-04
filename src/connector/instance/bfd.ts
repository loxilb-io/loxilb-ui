//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IBFDAttribute, IBfdInput} from 'types/bfd';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_bfd_all(instance: IInstance): Promise<IBFDAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/bfd/all'>>(instance, `/config/bfd/all`);
	assertOk(resp, 'Get BFD');
	return (resp.data?.Attr ?? []) as IBFDAttribute[];
}

export async function request_create_bfd(instance: IInstance, param: IBfdInput): Promise<OpResult> {
	return runOp('bfd.create_bfd', () => POST_INST(instance, `/config/bfd`, param));
}

export async function request_delete_bfd(instance: IInstance, remoteIp: string): Promise<OpResult> {
	return runOp('bfd.delete_bfd', () => DELETE_INST(instance, `/config/bfd/remoteIP/${remoteIp}`));
}
