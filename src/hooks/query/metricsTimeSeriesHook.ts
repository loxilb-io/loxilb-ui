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
	// Advanced Metrics
	query_get_live_metrics,
	query_get_cache_stats,
	query_metrics_health,
} from 'connector/instance/metrics';

import {ICtData} from 'types/conn_track';
import {IServiceDistTrafficData, ILiveMetricsResponse, ICacheStatsResponse, IHealthResponse} from 'types/metrics';
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

//---------------------------------------------------------
// Advanced Metrics Time Series Hooks
//---------------------------------------------------------

/**
 * Live metrics time series (cache-based, critical metrics only)
 */
export const useLiveMetricsCriticalSeries = createTimeSeriesHook(
	'live-metrics-critical-series',  // seriesKey: unique identifier for this hook
	'live-metrics-critical', 		 // metricsKey: query key for React Query
	(instance) => query_get_live_metrics(instance, 1), // fetcher: API call function
	raw => ({											// wrapData: data transformation function
		critical: raw.critical ?? {},
		total_metrics: raw.total_metrics ?? 0,
		cache_enabled: raw.cache_enabled ?? false,
		response_time_ms: raw.response_time_ms ?? 0,
		source: raw.source ?? 'fallback',
	})
);

/**
 * Live metrics time series (cache-based, all metrics)
 */
export const useLiveMetricsFullSeries = createTimeSeriesHook(
	'live-metrics-full-series', 
	'live-metrics-full', 
	(instance) => query_get_live_metrics(instance, 2),
	raw => ({
		critical: raw.critical ?? {},
		important: raw.important ?? {},
		total_metrics: raw.total_metrics ?? 0,
		cache_enabled: raw.cache_enabled ?? false,
		response_time_ms: raw.response_time_ms ?? 0,
		source: raw.source ?? 'fallback',
	})
);

/**
 * Cache statistics time series
 */
export const useCacheStatsSeries = createTimeSeriesHook(
	'cache-stats-series', 
	'cache-stats', 
	query_get_cache_stats,
	raw => ({
		enabled: raw.enabled ?? false,
		total_buffers: raw.total_buffers ?? 0,
		total_memory_bytes: raw.total_memory_bytes ?? 0,
		average_utilization: raw.average_utilization ?? 0,
		phase1_metrics_count: raw.phase1_metrics_count ?? 0,
		phase2_metrics_count: raw.phase2_metrics_count ?? 0,
		memory_usage_mb: raw.total_memory_bytes ? (raw.total_memory_bytes / (1024 * 1024)) : 0,
	})
);

/**
 * System health time series
 */
export const useSystemHealthSeries = createTimeSeriesHook(
	'system-health-series', 
	'system-health', 
	query_metrics_health,
	raw => ({
		status: raw.status ?? 'unhealthy',
		cache_enabled: raw.cache_enabled ?? false,
		total_buffers: raw.total_buffers ?? 0,
		memory_usage_mb: raw.memory_usage_mb ?? 0,
		average_utilization: raw.average_utilization ?? 0,
		is_healthy: raw.status === 'healthy',
		is_degraded: raw.status === 'degraded',
	})
);

export const useNewFlowSeries = createTimeSeriesHook('newflowcount-series', 'newflowcount', query_get_metrics_newflowcount, raw => ({new_flow_count: raw.new_flow_count}));

export const useLbRuleSeries = createTimeSeriesHook('lbrules-series', 'lbrules', query_get_metrics_lbrules, raw => ({lb_rule_count: raw.lb_rule_count}));
