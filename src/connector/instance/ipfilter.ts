//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IIPFilterEntry, IIPFilterDeleteParams} from 'types/security';
import {IInstance} from 'types/oam';
import {ApiResult, assertOk, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipfilter_all(instance: IInstance): Promise<IIPFilterEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/ipfilter/all'>>(instance, `/config/ipfilter/all`);
	assertOk(resp, 'Get IP Filter');
	return (resp.data?.ipFilterAttr ?? []) as IIPFilterEntry[];
}

export async function request_create_ipfilter_rule(instance: IInstance, data: IIPFilterEntry): Promise<ApiResult> {
	// Explicit payload: the page forwards the form ref verbatim, which also
	// carries the client-side isValid flag — send only IIPFilterEntry schema
	// fields (drop isValid + the read-only packets/bytes counters).
	const payload: IIPFilterEntry = {
		filterType: data.filterType,
		cidr: data.cidr,
		zone: data.zone,
		priority: data.priority,
		action: data.action,
	};
	const resp = await POST_INST(instance, `/config/ipfilter`, payload);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'IP Filter Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_ipfilter_rule(instance: IInstance, params: IIPFilterDeleteParams): Promise<ApiResult> {
	const urlParams = new URLSearchParams();
	urlParams.append('filterType', params.filterType);
	urlParams.append('cidr', params.cidr);
	if (params.zone !== undefined) {
		urlParams.append('zone', String(params.zone));
	}

	const url = `/config/ipfilter?${urlParams.toString()}`;
	const resp = await DELETE_INST(instance, url);

	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'IP Filter Operation');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
