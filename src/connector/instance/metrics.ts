//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
	IEndpointDistributionTraffic,
	IErrorCount,
	IFirewallDropReport,
	IHostCount,
	ILBProcessedTraffic,
	ILBRuleCount,
	INetworkFlowStats,
	INewFlowCount,
	IProcessedTraffic,
	IRequestCount,
	IRequestCountPerClient,
	IServiceDistTrafficData,
} from 'types/metrics';
import {IInstance} from 'types/oam';
import {GET_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_metrics_endpoint(instance: IInstance): Promise<IEndpointDistributionTraffic> {
	const resp = await GET_INST(instance, `/metrics/epdisttraffic`);
	return (resp.data as IEndpointDistributionTraffic) ?? {};
}

export async function query_get_metrics_service_dist_traffic(instance: IInstance): Promise<IServiceDistTrafficData> {
	const resp = await GET_INST(instance, `/metrics/servicedisttraffic`);
	return (resp.data as IServiceDistTrafficData) ?? {};
}

export async function query_get_metrics_traffic(instance: IInstance): Promise<IProcessedTraffic> {
	const resp = await GET_INST(instance, `/metrics/processedtraffic`);
	return (resp.data as IProcessedTraffic) ?? {};
}

export async function query_get_metrics_error(instance: IInstance): Promise<IErrorCount> {
	const resp = await GET_INST(instance, `/metrics/errorcount`);
	return (resp.data as IErrorCount) ?? {};
}

export async function query_get_metrics_fwdrops(instance: IInstance): Promise<IFirewallDropReport> {
	const resp = await GET_INST(instance, `/metrics/fwdrops`);
	return (resp.data as IFirewallDropReport) ?? {};
}

export async function query_get_metrics_lbrules(instance: IInstance): Promise<ILBRuleCount> {
	const resp = await GET_INST(instance, `/metrics/lbrulecount`);
	return (resp.data as ILBRuleCount) ?? {};
}

export async function query_get_metrics_netflow(instance: IInstance): Promise<INetworkFlowStats> {
	const resp = await GET_INST(instance, `/metrics/flowcount`);
	return (resp.data as INetworkFlowStats) ?? {};
}

export async function query_get_metrics_req_count(instance: IInstance): Promise<IRequestCount> {
	const resp = await GET_INST(instance, `/metrics/requestcount`);
	return (resp.data as IRequestCount) ?? {};
}

export async function query_get_metrics_req_count_per_client(instance: IInstance): Promise<IRequestCountPerClient> {
	const resp = await GET_INST(instance, `/metrics/reqcountperclient`);
	return (resp.data as IRequestCountPerClient) ?? {};
}

export async function query_get_metrics_hostcount(instance: IInstance): Promise<IHostCount> {
	const resp = await GET_INST(instance, `/metrics/hostcount`);
	return (resp.data as IHostCount) ?? {};
}

export async function query_get_metrics_newflowcount(instance: IInstance): Promise<INewFlowCount> {
	const resp = await GET_INST(instance, `/metrics/newflowcount`);
	return (resp.data as INewFlowCount) ?? {};
}

export async function query_get_metrics_lbprocessedtraffic(instance: IInstance): Promise<ILBProcessedTraffic> {
	const resp = await GET_INST(instance, `/metrics/lbprocessedtraffic`);
	return (resp.data as ILBProcessedTraffic) ?? {};
}
