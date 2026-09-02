//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IEndpointInput, IEndpointItem} from 'types/endpoint';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_endpoint_all(instance: IInstance): Promise<IEndpointItem[]> {
	const resp = await GET_INST<GwGetResp<'/config/endpoint/all'>>(instance, `/config/endpoint/all`);
	assertOk(resp, 'Get Endpoint');
	return (resp.data?.Attr ?? []) as IEndpointItem[];
}

export async function request_create_endpoint(instance: IInstance, data: IEndpointInput): Promise<OpResult> {
	// The input form's onChange emits its validation state (isValid/errors)
	// alongside the field values; build an explicit IEndpointInput payload so
	// those client-only keys can never leak into the gateway POST.
	const payload: IEndpointInput = {
		hostName: data.hostName,
		name: data.name,
		inactiveReTries: data.inactiveReTries,
		probeType: data.probeType,
		probeReq: data.probeReq,
		probeResp: data.probeResp,
		probeDuration: data.probeDuration,
		probePort: data.probePort,
	};
	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/endpoint`, payload), 'endpoint.create');
	} catch (error) {
		return fromNetworkError('endpoint.create', error);
	}
}

export async function request_delete_endpoint_by_ip(instance: IInstance, item: IEndpointItem): Promise<OpResult> {
	// DELETE /config/endpoint/epipaddress/{ip} identifies the exact endpoint via
	// query params (name, probe_type, probe_port) - now declared in swagger.
	// Build query parameters conditionally, omitting null/undefined values
	const queryParams = [];
	if (item.name) queryParams.push(`name=${item.name}`);
	if (item.probeType) queryParams.push(`probe_type=${item.probeType}`);
	if (item.probePort) queryParams.push(`probe_port=${item.probePort}`);
	
	const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
	const curl_with_query = `/config/endpoint/epipaddress/${item.hostName}${queryString}`;
	let resp;
	try {
		resp = await DELETE_INST(instance, curl_with_query);
	} catch (error) {
		return fromNetworkError('endpoint.delete', error);
	}

	const res = fromSimpleResponse(resp, 'endpoint.delete');
	// The gateway can answer 200 with a result string like "endpoint referred
	// by loadbalancer rule" when the delete is rejected. The legacy check
	// sniffed resp.message — the HTTP reason phrase on HTTP/1.1 ("OK"), so it
	// only ever fired over HTTP/2. Inspect the BODY's result string directly;
	// transport-independent ( batch 3, D7).
	const bodyResult = typeof (resp.data as any)?.result === 'string' ? (resp.data as any).result.toLowerCase() : '';
	if (res.status === 'confirmed' && (bodyResult.includes('error') || bodyResult.includes('referred'))) {
		return {...res, status: 'failed', code: 'endpoint.delete.reported_failure', localeKey: STATUS_LOCALE_KEYS.failed, data: undefined, rawDetail: (resp.data as any).result};
	}
	return res;
}
