//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IServiceConfiguration} from 'types/load_balancer';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_load_balancer_config_all(instance: IInstance): Promise<IServiceConfiguration[]> {
	const resp = await GET_INST(instance, `/config/loadbalancer/all`);
	return (resp.data?.lbAttr as IServiceConfiguration[]) ?? [];
}

export async function request_create_load_balancer_config(instance: IInstance, data: IServiceConfiguration): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/loadbalancer`, data);
	if (resp.code !== 200) return {status: 'error', error: `Failed to create loadbalancer: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_all_load_balancers(instance: IInstance): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/loadbalancer/all`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete all loadbalancers: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_lb_by_name(instance: IInstance, lb_name: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/loadbalancer/name/${lb_name}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete by name: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_lb_by_ip_port_proto(instance: IInstance, ip: string, port: number, proto: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/loadbalancer/externalipaddress/${ip}/port/${port}/protocol/${proto}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete by ip/port/proto: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_lb_by_hosturl_ip_port_proto(instance: IInstance, hosturl: string, ip: string, port: number, proto: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/loadbalancer/hosturl/${hosturl}/externalipaddress/${ip}/port/${port}/protocol/${proto}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete by hosturl/ip/port/proto: ${resp.message}`};
	else return {status: 'success'};
}
