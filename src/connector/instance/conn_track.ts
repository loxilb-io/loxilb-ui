//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ICtData} from 'types/conn_track';
import {IInstance} from 'types/oam';
import {GET_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_conntrack_all(instance: IInstance): Promise<ICtData> {
	const resp = await GET_INST<GwGetResp<'/config/conntrack/all'>>(instance, `/config/conntrack/all`);
	if (!resp || !resp.data) return {ctAttr: []};
	else return resp.data as ICtData;
}
