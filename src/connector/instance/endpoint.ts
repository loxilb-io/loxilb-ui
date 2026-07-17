//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IEndpointInput, IEndpointItem} from 'types/endpoint';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_endpoint_all(instance: IInstance): Promise<IEndpointItem[]> {
	const resp = await GET_INST<GwGetResp<'/config/endpoint/all'>>(instance, `/config/endpoint/all`);
	return (resp.data?.Attr ?? []) as IEndpointItem[];
}

export async function request_create_endpoint(instance: IInstance, data: IEndpointInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/endpoint`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Create Endpoint');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_endpoint_by_ip(instance: IInstance, item: IEndpointItem): Promise<ApiResult> {
	// DELETE /config/endpoint/epipaddress/{ip} identifies the exact endpoint via
	// query params (name, probe_type, probe_port) - now declared in swagger.
	// Build query parameters conditionally, omitting null/undefined values
	const queryParams = [];
	if (item.name) queryParams.push(`name=${item.name}`);
	if (item.probeType) queryParams.push(`probe_type=${item.probeType}`);
	if (item.probePort) queryParams.push(`probe_port=${item.probePort}`);
	
	const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
	const curl_with_query = `/config/endpoint/epipaddress/${item.hostName}${queryString}`;
	const resp = await DELETE_INST(instance, curl_with_query);

	if (resp.code !== 200 && resp.code !== 204 || resp.message.includes('error') || resp.message.includes('referred')) {
		const errorMessage = createDetailedErrorMessage(resp, 'Delete Endpoint');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}
