//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {IPortAttribute} from 'types/port';
import {assertOk} from '../fetcher/fetcher_base';
import {GET_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_port_all(instance: IInstance): Promise<IPortAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/port/all'>>(instance, `/config/port/all`);
	assertOk(resp, 'Get Port');
	return (resp.data?.portAttr ?? []) as IPortAttribute[];
}
