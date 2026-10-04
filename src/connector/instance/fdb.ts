//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFdbAttribute} from 'types/fdb';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_fdb_all(instance: IInstance): Promise<IFdbAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/fdb/all'>>(instance, `/config/fdb/all`);
	assertOk(resp, 'Get FDB');
	return (resp.data?.fdbAttr ?? []) as IFdbAttribute[];
}

export async function request_create_fdb(instance: IInstance, data: IFdbAttribute): Promise<OpResult> {
	return runOp('fdb.create_fdb', () => POST_INST(instance, `/config/fdb`, data));
}

export async function request_delete_fdb(instance: IInstance, mac: string, dev: string): Promise<OpResult> {
	return runOp('fdb.delete_fdb', () => DELETE_INST(instance, `/config/fdb/${mac}/dev/${dev}`));
}
