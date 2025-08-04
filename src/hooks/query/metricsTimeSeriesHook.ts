//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_conntrack_all} from 'connector/instance/conn_track';
import {
	query_get_metrics_error,
	query_get_metrics_fwdrops,
	query_get_metrics_hostcount,
	query_get_metrics_lbprocessedtraffic,
	query_get_metrics_lbrules,
	query_get_metrics_netflow,
	query_get_metrics_newflowcount,
	query_get_metrics_service_dist_traffic,
	query_get_metrics_traffic,
} from 'connector/instance/metrics';

import {ICtData} from 'types/conn_track';
import {IServiceDistTrafficData} from 'types/metrics';
import {createTimeSeriesHook} from './common';

//---------------------------------------------------------
// Hook Instances
//---------------------------------------------------------
export const useTrafficSeries = createTimeSeriesHook('traffic-series', 'traffic', query_get_metrics_traffic, raw => ({
	processed_bytes: raw?.processed_bytes ?? 0,
	processed_tcp_bytes: raw?.processed_tcp_bytes ?? 0,
	processed_sctp_bytes: raw?.processed_sctp_bytes ?? 0,
	processed_udp_bytes: raw?.processed_udp_bytes ?? 0,
	processed_packets: raw?.processed_packets ?? 0,
}));

export const useServiceDistSeries = createTimeSeriesHook(
	'service-dist-series',
	'service-dist-traffic',
	query_get_metrics_service_dist_traffic,
	raw => raw as IServiceDistTrafficData,
);

export const useConntrackSeries = createTimeSeriesHook('conntrack-series', 'conntrack', query_get_conntrack_all, raw => raw as ICtData);

export const useNetflowSeries = createTimeSeriesHook('netflow-series', 'netflow', query_get_metrics_netflow, raw => ({
	active_conntrack_count: raw.active_conntrack_count ?? 0,
	active_flow_count_tcp: raw.active_flow_count_tcp ?? 0,
	active_flow_count_udp: raw.active_flow_count_udp ?? 0,
	active_flow_count_sctp: raw.active_flow_count_sctp ?? 0,
	inactive_flow_count: raw.inactive_flow_count ?? 0,
}));

export const useFwDropSeries = createTimeSeriesHook('fwdrops-series', 'fwdrops', query_get_metrics_fwdrops, raw => ({
	total_fw_drops: raw.total_fw_drops,
	total_fw_drops_per_rule: raw.total_fw_drops_per_rule,
}));

export const useErrorSeries = createTimeSeriesHook('error-series', 'error', query_get_metrics_error, raw => ({
	total_errors: raw.total_errors,
	total_errors_per_service: raw.total_errors_per_service,
}));

export const useLbProcessedSeries = createTimeSeriesHook('lbprocessed-series', 'lbprocessed', query_get_metrics_lbprocessedtraffic, raw => ({
	lb_rule_interaction_bytes: raw.lb_rule_interaction_bytes,
	lb_rule_interaction_packets: raw.lb_rule_interaction_packets,
}));

export const useHostCountSeries = createTimeSeriesHook('hostcount-series', 'hostcount', query_get_metrics_hostcount, raw => ({
	healthy_host_count: raw.healthy_host_count,
	unhealthy_host_count: raw.unhealthy_host_count,
}));

export const useNewFlowSeries = createTimeSeriesHook('newflowcount-series', 'newflowcount', query_get_metrics_newflowcount, raw => ({new_flow_count: raw.new_flow_count}));

export const useLbRuleSeries = createTimeSeriesHook('lbrules-series', 'lbrules', query_get_metrics_lbrules, raw => ({lb_rule_count: raw.lb_rule_count}));
