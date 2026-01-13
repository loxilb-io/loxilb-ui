//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IIPFilterEntry, IIPFilterDeleteParams} from 'types/security';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipfilter_all(instance: IInstance): Promise<IIPFilterEntry[]> {
	const resp = await GET_INST(instance, `/config/ipfilter/all`);
	return (resp.data?.ipFilterAttr as IIPFilterEntry[]) ?? [];
}

export async function request_create_ipfilter_rule(instance: IInstance, data: IIPFilterEntry): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipfilter`, data);
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
