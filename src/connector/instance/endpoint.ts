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
	/*
	아래 예시와 같이 쿼리를 넣어서 Delete를 보내야 삭제됨, Swagger에는 없지만 실제로는 이렇게 동작함
	curl -X 'DELETE' \
	'http://0.0.0.0:11111/netlox/v1/config/endpoint/epipaddress/32.32.32.1?name=32.32.32.1_http_8080&probe_type=http&probe_port=8080' \
	-H 'accept: application/json'
	*/

	//const resp = await DELETE_INST(instance, `/config/endpoint/epipaddress/${item.hostName}`, {name: item.name, probe_type: item.probeType, probe_port: item.probePort});
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
