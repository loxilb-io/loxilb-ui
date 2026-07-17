//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {IPortAttribute} from 'types/port';
import {GET_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_port_all(instance: IInstance): Promise<IPortAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/port/all'>>(instance, `/config/port/all`);
	return (resp.data?.portAttr ?? []) as IPortAttribute[];
}
