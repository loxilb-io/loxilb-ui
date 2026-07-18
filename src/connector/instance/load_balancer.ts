//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IServiceConfiguration} from 'types/load_balancer';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, PATCH_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
function cleanNegativeNumbers(obj: any): any {
	if (obj === null || obj === undefined) return obj;
	
	if (Array.isArray(obj)) {
		return obj.map(item => cleanNegativeNumbers(item));
	}
	
	if (typeof obj === 'object') {
		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			// Skip keys with negative number values
			if (typeof value === 'number' && value < 0) {
				continue;
			}
			cleaned[key] = cleanNegativeNumbers(value);
		}
		return cleaned;
	}
	
	return obj;
}

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_load_balancer_config_all(instance: IInstance): Promise<IServiceConfiguration[]> {
	const resp = await GET_INST<GwGetResp<'/config/loadbalancer/all'>>(instance, `/config/loadbalancer/all`);
	return (resp.data?.lbAttr ?? []) as IServiceConfiguration[];
}

export async function request_create_load_balancer_config(instance: IInstance, data: IServiceConfiguration): Promise<ApiResult> {
	// Remove keys with negative number values to avoid backend type errors
	let cleanedData = cleanNegativeNumbers(data);
	
	// Clean up probe values according to serviceArguments.monitor value
	// If monitor is false, remove probetype, probeport, probereq, proberesp, probeTimeout, probeRetries
	if (cleanedData.serviceArguments && !cleanedData.serviceArguments.monitor) {
		const {probetype, probeport, probereq, proberesp, probeTimeout, probeRetries, ...serviceArgs} = cleanedData.serviceArguments;
		cleanedData = {
			...cleanedData,
			serviceArguments: serviceArgs
		};
	}
	
	const resp = await POST_INST(instance, `/config/loadbalancer`, cleanedData);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Create Load Balancer');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

/**
 * Apply an RFC 7386 JSON merge-patch to an existing LB rule identified by its
 * VIP/port/protocol composite key. Fields present are overwritten, absent
 * fields untouched. Immutable fields (mode, security, egress, protocol, VIP
 * key) are rejected by the gateway with 400 — callers must exclude them.
 */
export async function request_patch_load_balancer_config(
	instance: IInstance,
	ip: string,
	port: number,
	proto: string,
	patch: Partial<IServiceConfiguration>,
): Promise<ApiResult> {
	const resp = await PATCH_INST(instance, `/config/loadbalancer/externalipaddress/${ip}/port/${port}/protocol/${proto}`, patch);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Load Balancer Patch');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}

export async function request_delete_lb_by_ip_port_proto(instance: IInstance, ip: string, port: number, proto: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/loadbalancer/externalipaddress/${ip}/port/${port}/protocol/${proto}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Delete Load Balancer');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function request_delete_lb_by_ip_portrange_proto(instance: IInstance, ip: string, port: number, portmax: number, proto: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/loadbalancer/externalipaddress/${ip}/port/${port}/portmax/${portmax}/protocol/${proto}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Delete Load Balancer');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

