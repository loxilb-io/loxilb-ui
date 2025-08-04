//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IEndpointInput, IEndpointItem} from 'types/endpoint';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_endpoint_all(instance: IInstance): Promise<IEndpointItem[]> {
	const resp = await GET_INST(instance, `/config/endpoint/all`);
	return (resp.data?.Attr as IEndpointItem[]) ?? [];
}

export async function request_create_endpoint(instance: IInstance, data: IEndpointInput): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/endpoint`, data);
	if (resp.code !== 200) return {status: 'error', error: `Failed to create endpoint: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_endpoint_by_ip(instance: IInstance, item: IEndpointItem): Promise<ApiResult> {
	/*
	아래 예시와 같이 쿼리를 넣어서 Delete를 보내야 삭제됨, Swagger에는 없지만 실제로는 이렇게 동작함
	curl -X 'DELETE' \
	'http://0.0.0.0:11111/netlox/v1/config/endpoint/epipaddress/32.32.32.1?name=32.32.32.1_http_8080&probe_type=http&probe_port=8080' \
	-H 'accept: application/json'
	*/

	//const resp = await DELETE_INST(instance, `/config/endpoint/epipaddress/${item.hostName}`, {name: item.name, probe_type: item.probeType, probe_port: item.probePort});
	const curl_with_query = `/config/endpoint/epipaddress/${item.hostName}?name=${item.name}&probe_type=${item.probeType}&probe_port=${item.probePort}`;
	const resp = await DELETE_INST(instance, curl_with_query);

	if (resp.code !== 200 || resp.message.includes('error') || resp.message.includes('referred')) return {status: 'error', error: `"${resp.message}"`};
	else return {status: 'success'};
}
