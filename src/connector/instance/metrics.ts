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
	ILiveMetricsResponse,
} from 'types/metrics';
import {IInstance} from 'types/oam';
import {GET_INST, GET_INST_TEXT} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Live JSON Metrics (gateway: /netlox/v1/metrics/*)
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

//---------------------------------------------------------
// Live Metrics via Prometheus exposition (gateway: /netlox/v1/metrics)
//---------------------------------------------------------

// Parses Prometheus text format into a flat {metric_name: value} map.
// Labeled samples of the same metric are summed, which matches how the
// dashboard cards consume the previously flat /metrics/live response.
function parse_prometheus_text(text: string): Record<string, number> {
	const values: Record<string, number> = {};
	for (const line of text.split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+]+)/);
		if (!match) continue;
		const value = Number(match[3]);
		if (!Number.isFinite(value)) continue;
		values[match[1]] = (values[match[1]] ?? 0) + value;
	}
	return values;
}

/**
 * Get a real-time snapshot of all gateway metrics.
 * The gateway exposes its metric registry in Prometheus text format; metric
 * names are identical to the fields the dashboard cards read (rps_bps,
 * active_conntrack_count, lb_rule_count, ...).
 */
export async function query_get_live_metrics(instance: IInstance, _phase: 1 | 2 = 2): Promise<ILiveMetricsResponse> {
	const resp = await GET_INST_TEXT(instance, `/metrics`);
	const metrics = typeof resp.data === 'string' ? parse_prometheus_text(resp.data) : {};
	return {
		timestamp: Date.now(),
		critical: metrics,
		important: metrics,
		total_metrics: Object.keys(metrics).length,
	};
}
