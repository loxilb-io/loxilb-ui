//---------------------------------------------------------
// Advanced Metrics Hooks
//---------------------------------------------------------
import { useQuery } from '@tanstack/react-query';
import {useQueryInstanceData} from 'hooks/query/common';
import {
	query_get_live_metrics,
	query_get_cache_stats,
	query_get_metric_history,
	query_get_metric_value,
	query_metrics_database,
	query_metrics_aggregate,
	query_metrics_batch,
	query_unified_metrics,
	query_historical_metrics,
	query_advanced_live_metrics,
	query_metrics_health,
	query_critical_metrics,
	query_metrics_by_category,
	query_comprehensive_metrics,
} from 'connector/instance/advancedMetrics';
import {
	ILiveMetricsResponse,
	ICacheStatsResponse,
	IMetricHistoryResponse,
	IMetricValueResponse,
	IQueryResponse,
	IMetricsHealthResponse,
	IMetricsQueryParams,
	IMetricsAggregateParams,
	IUnifiedMetricsParams,
	IHistoricalMetricsParams,
	IBatchQueryRequest,
	IBatchQueryResponse,
	IAggregatedMetricsResponse,
	IUnifiedQueryResponse,
	IHistoricalMetricsResponse,
	IAdvancedLiveMetricsResponse,
} from 'types/advancedMetrics';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Live Metrics Hooks
//---------------------------------------------------------

/**
 * Hook for live metrics from cache
 */
export const useLiveMetrics = (instance: IInstance | null, phase: 1 | 2 = 2, metricNames?: string, format?: 'json' | 'prometheus') => {
	return useQueryInstanceData(
		['live-metrics', phase.toString(), metricNames || 'all', format || 'json'],
		(inst) => query_get_live_metrics(inst, phase, metricNames, format),
		instance
	);
};

/**
 * Hook for advanced live metrics
 */
export const useAdvancedLiveMetrics = (instance: IInstance | null, phase: 1 | 2 = 2, metrics?: string, format?: 'json' | 'prometheus') => {
	return useQueryInstanceData(
		['advanced-live-metrics', phase.toString(), metrics || 'all', format || 'json'],
		(inst) => query_advanced_live_metrics(inst, phase, metrics, format),
		instance
	);
};

/**
 * Hook for cache statistics
 */
export const useCacheStats = (instance: IInstance | null) => {
	return useQueryInstanceData(['cache-stats'], query_get_cache_stats, instance);
};

/**
 * Hook for system health
 */
export const useMetricsHealth = (instance: IInstance | null) => {
	return useQueryInstanceData(['metrics-health'], query_metrics_health, instance);
};

/**
 * Hook for metric history
 */
export const useMetricHistory = (
	instance: IInstance | null, 
	metricName: string, 
	startTime?: number,
	endTime?: number,
	interval?: number
) => {
	return useQueryInstanceData(
		['metric-history', metricName, startTime?.toString() || 'auto', endTime?.toString() || 'auto', interval?.toString() || 'auto'],
		(inst) => query_get_metric_history(inst, metricName, startTime, endTime, interval),
		instance,
		false, // not infinity
		false  // not common data
	);
};

/**
 * Hook for single metric value
 */
export const useMetricValue = (instance: IInstance | null, metricName: string) => {
	return useQueryInstanceData(
		['metric-value', metricName],
		(inst) => query_get_metric_value(inst, metricName),
		instance
	);
};

//---------------------------------------------------------
// Database Query Hooks
//---------------------------------------------------------

/**
 * Hook for database queries
 */
export const useMetricsDatabase = (instance: IInstance | null, params: IMetricsQueryParams) => {
	return useQueryInstanceData(
		['metrics-database', JSON.stringify(params)],
		(inst) => query_metrics_database(inst, params),
		instance,
		true // infinity cache since historical data doesn't change
	);
};

/**
 * Hook for aggregation queries
 */
export const useMetricsAggregate = (instance: IInstance | null, params: IMetricsAggregateParams) => {
	return useQueryInstanceData(
		['metrics-aggregate', JSON.stringify(params)],
		(inst) => query_metrics_aggregate(inst, params),
		instance,
		true // infinity cache
	);
};

/**
 * Hook for unified metrics query
 */
export const useUnifiedMetrics = (instance: IInstance | null, params: IUnifiedMetricsParams) => {
	return useQueryInstanceData(
		['unified-metrics', JSON.stringify(params)],
		(inst) => query_unified_metrics(inst, params),
		instance
	);
};

/**
 * Hook for historical metrics (database-only)
 */
export const useHistoricalMetrics = (instance: IInstance | null, params: IHistoricalMetricsParams) => {
	return useQueryInstanceData(
		['historical-metrics', JSON.stringify(params)],
		(inst) => query_historical_metrics(inst, params),
		instance,
		true // infinity cache
	);
};

//---------------------------------------------------------
// Action Functions for Batch Operations
//---------------------------------------------------------

/**
 * Action function for batch metric queries
 */
export const batchQueryMetrics = async (instance: IInstance, request: IBatchQueryRequest): Promise<IBatchQueryResponse> => {
	return query_metrics_batch(instance, request);
};

//---------------------------------------------------------
// Convenience Hooks with Pre-configured Parameters
//---------------------------------------------------------

/**
 * Hook for critical metrics only (phase 1)
 */
export const useCriticalMetrics = (instance: IInstance | null) => {
	return useLiveMetrics(instance, 1);
};

/**
 * Hook for all metrics (phase 2)
 */
export const useAllLiveMetrics = (instance: IInstance | null) => {
	return useLiveMetrics(instance, 2);
};

/**
 * Hook for Prometheus format metrics
 */
export const usePrometheusMetrics = (instance: IInstance | null, phase: 1 | 2 = 2) => {
	return useLiveMetrics(instance, phase, undefined, 'prometheus');
};

/**
 * Hook for recent metrics (last hour)
 */
export const useRecentMetrics = (instance: IInstance | null, metrics?: string) => {
	const endTime = Math.floor(Date.now() / 1000);
	const startTime = endTime - 3600; // 1 hour ago
	
	return useUnifiedMetrics(instance, {
		time_start: startTime,
		time_end: endTime,
		metrics,
		source: 'auto'
	});
};

/**
 * Hook for today's metrics
 */
export const useTodayMetrics = (instance: IInstance | null, metrics?: string) => {
	const now = new Date();
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startTime = Math.floor(startOfDay.getTime() / 1000);
	const endTime = Math.floor(Date.now() / 1000);
	
	return useHistoricalMetrics(instance, {
		time_start: startTime,
		time_end: endTime,
		metrics
	});
};

/**
 * Hook for metrics from last 24 hours
 */
export const useLast24HoursMetrics = (instance: IInstance | null, metrics?: string) => {
	const endTime = Math.floor(Date.now() / 1000);
	const startTime = endTime - 86400; // 24 hours ago
	
	return useHistoricalMetrics(instance, {
		time_start: startTime,
		time_end: endTime,
		metrics
	});
};

/**
 * Hook for metrics from last week
 */
export const useLastWeekMetrics = (instance: IInstance | null, metrics?: string) => {
	const endTime = Math.floor(Date.now() / 1000);
	const startTime = endTime - 604800; // 7 days ago
	
	return useHistoricalMetrics(instance, {
		time_start: startTime,
		time_end: endTime,
		metrics
	});
};

//---------------------------------------------------------
// System Health and Performance Hooks
//---------------------------------------------------------

/**
 * Hook for overall system health status
 */
export const useSystemHealthStatus = (instance: IInstance | null) => {
	const { data: health, isLoading, error } = useMetricsHealth(instance);
	
	const status = {
		overall: health?.data?.overall_status || 'unknown',
		cache: health?.data?.cache_status || 'unknown',
		database: health?.data?.database_status || 'unknown',
		api: health?.data?.api_status || 'unknown',
		uptime: health?.data?.uptime_seconds || 0,
		isHealthy: health?.data?.overall_status === 'healthy',
	};
	
	return {
		data: status,
		isLoading,
		error,
	};
};

/**
 * Hook for cache performance metrics
 */
export const useCachePerformance = (instance: IInstance | null) => {
	const { data: cacheStats, isLoading, error } = useCacheStats(instance);
	
	const performance = {
		hitRate: cacheStats?.data?.hit_rate_percentage || 0,
		missRate: cacheStats?.data?.miss_rate_percentage || 0,
		memoryUsage: cacheStats?.data?.memory_usage_formatted || '0 B',
		avgReadTime: cacheStats?.data?.performance_metrics?.avg_read_time_ms || 0,
		avgWriteTime: cacheStats?.data?.performance_metrics?.avg_write_time_ms || 0,
		operationsPerSecond: cacheStats?.data?.performance_metrics?.operations_per_second || 0,
		totalEntries: cacheStats?.data?.total_entries || 0,
	};
	
	return {
		data: performance,
		isLoading,
		error,
	};
};

/**
 * Hook for aggregated metrics with hourly intervals
 */
export const useHourlyAggregatedMetrics = (instance: IInstance | null, metrics?: string, hours: number = 24) => {
	const endTime = Math.floor(Date.now() / 1000);
	const startTime = endTime - (hours * 3600);
	
	return useMetricsAggregate(instance, {
		time_start: startTime,
		time_end: endTime,
		metrics,
		interval: 3600, // 1 hour
		function: 'avg'
	});
};

/**
 * Hook for aggregated metrics with daily intervals
 */
export const useDailyAggregatedMetrics = (instance: IInstance | null, metrics?: string, days: number = 7) => {
	const endTime = Math.floor(Date.now() / 1000);
	const startTime = endTime - (days * 86400);
	
	return useMetricsAggregate(instance, {
		time_start: startTime,
		time_end: endTime,
		metrics,
		interval: 86400, // 1 day
		function: 'avg'
	});
};

//---------------------------------------------------------
// Enhanced Advanced Metrics Hooks
//---------------------------------------------------------

/**
 * Hook for critical metrics with priority-based filtering
 */
export const useAdvancedCriticalMetrics = (instance: IInstance | null, params?: any) => {
	return useQueryInstanceData(
		['advanced-critical-metrics', JSON.stringify(params || {})],
		(inst) => query_critical_metrics(inst, params),
		instance
	);
};

/**
 * Hook for metrics by category
 */
export const useMetricsByCategory = (instance: IInstance | null, categories: string, params?: any) => {
	return useQueryInstanceData(
		['metrics-by-category', categories, JSON.stringify(params || {})],
		(inst) => query_metrics_by_category(inst, categories, params),
		instance
	);
};

/**
 * Hook for comprehensive metrics dashboard data with 10-second polling
 */
export const useComprehensiveMetrics = (
	instance: IInstance | null, 
	timeRange: number = 3600000, // Default 1 hour
	params?: any,
	enablePolling: boolean = true
) => {
	// Use react-query directly to have more control over polling
	return useQuery({
		queryKey: ['comprehensive-metrics', timeRange.toString(), JSON.stringify(params || {}), instance?.id],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_comprehensive_metrics(instance, timeRange, params);
		},
		enabled: !!instance,
		retry: (failureCount, error) => (error as any).status !== 404 && failureCount < 3,
		retryDelay: 3000,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		refetchInterval: enablePolling ? 10000 : false, // 10-second polling if enabled
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
};

/**
 * Hook for connection tracking metrics
 */
export const useConnectionTrackingMetrics = (instance: IInstance | null) => {
	const connectionMetrics = [
		'active_conntrack_count',
		'active_flow_count_tcp',
		'active_flow_count_udp',
		'active_flow_count_sctp',
		'inactive_flow_count',
		'new_flow_count'
	].join(',');
	
	return useMetricsByCategory(instance, 'connection_tracking', { metrics: connectionMetrics });
};

/**
 * Hook for load balancer metrics
 */
export const useLoadBalancerMetrics = (instance: IInstance | null) => {
	const lbMetrics = [
		'lb_rule_count',
		'lb_rules_per_service', 
		'total_requests',
		'total_requests_per_service',
		'total_errors',
		'total_errors_per_service'
	].join(',');
	
	return useMetricsByCategory(instance, 'load_balancer', { metrics: lbMetrics });
};

/**
 * Hook for health metrics
 */
export const useHealthMetrics = (instance: IInstance | null) => {
	const healthMetrics = [
		'healthy_host_count',
		'unhealthy_host_count',
		'endpoint_health',
		'healthy_endpoints_count', 
		'unhealthy_endpoints_count'
	].join(',');
	
	return useMetricsByCategory(instance, 'health', { metrics: healthMetrics });
};

/**
 * Hook for firewall metrics
 */
export const useFirewallMetrics = (instance: IInstance | null) => {
	const fwMetrics = [
		'total_fw_drops',
		'total_fw_drops_per_rule',
		'firewall_rules_count'
	].join(',');
	
	return useMetricsByCategory(instance, 'firewall', { metrics: fwMetrics });
};

/**
 * Hook for RPS (Requests Per Second) metrics
 */
export const useRPSMetrics = (instance: IInstance | null) => {
	const rpsMetrics = [
		'rps_1m_avg',
		'rps_1m_peak',
		'rps_bps',
		'rps_pps',
		'rps_eps',
		'rps_requests',
		'rps_time_window',
		'rps_trend_score',
		'rps_tcp_bps',
		'rps_udp_bps',
		'rps_sctp_bps',
		'rps_tcp_pps',
		'rps_udp_pps',
		'rps_sctp_pps',
		'rps_lb_interaction_bps',
		'rps_lb_interaction_pps'
	].join(',');
	
	return useMetricsByCategory(instance, 'rps', { metrics: rpsMetrics });
};

/**
 * Hook for processing metrics
 */
export const useProcessingMetrics = (instance: IInstance | null) => {
	const processingMetrics = [
		'processed_bytes_total',
		'processed_packets_total',
		'processed_tcp_bytes',
		'processed_udp_bytes', 
		'processed_sctp_bytes',
		'processed_tcp_packets',
		'processed_udp_packets',
		'processed_sctp_packets'
	].join(',');
	
	return useMetricsByCategory(instance, 'processing', { metrics: processingMetrics });
};

/**
 * Hook for distribution metrics
 */
export const useDistributionMetrics = (instance: IInstance | null) => {
	const distributionMetrics = [
		'lb_rule_interaction_bytes',
		'lb_rule_interaction_packets',
		'service_traffic_bytes',
		'endpoint_traffic_bytes',
		'service_distribution_ratio',
		'total_load_dists_per_service',
		'endpoint_load_dists_per_service'
	].join(',');
	
	return useMetricsByCategory(instance, 'distribution', { metrics: distributionMetrics });
};

//---------------------------------------------------------
// Time Range Specific Hooks
//---------------------------------------------------------

/**
 * Hook for last 15 minutes of metrics
 */
export const useLast15MinutesMetrics = (instance: IInstance | null, enablePolling: boolean = true) => {
	return useComprehensiveMetrics(instance, 15 * 60 * 1000, undefined, enablePolling);
};

/**
 * Hook for last hour of metrics
 */
export const useLastHourMetrics = (instance: IInstance | null, enablePolling: boolean = true) => {
	return useComprehensiveMetrics(instance, 60 * 60 * 1000, undefined, enablePolling);
};

/**
 * Hook for last 6 hours of metrics
 */
export const useLast6HoursMetrics = (instance: IInstance | null, enablePolling: boolean = false) => {
	return useComprehensiveMetrics(instance, 6 * 60 * 60 * 1000, undefined, enablePolling);
};

/**
 * Hook for last 12 hours of metrics
 */
export const useLast12HoursMetrics = (instance: IInstance | null, enablePolling: boolean = false) => {
	return useComprehensiveMetrics(instance, 12 * 60 * 60 * 1000, undefined, enablePolling);
};

//---------------------------------------------------------
// Utility Hooks for Dashboard Management
//---------------------------------------------------------

/**
 * Hook with pause/resume capability for polling
 */
export const useAdvancedMetricsWithControl = (
	instance: IInstance | null,
	timeRange: number = 3600000,
	pollingEnabled: boolean = true
) => {
	return useComprehensiveMetrics(instance, timeRange, undefined, pollingEnabled);
};

/**
 * Hook for metrics with pagination support
 */
export const useAdvancedMetricsPaginated = (
	instance: IInstance | null,
	limit: number = 100,
	offset: number = 0,
	params?: any
) => {
	const queryParams = {
		...params,
		limit,
		offset
	};
	
	return useQueryInstanceData(
		['advanced-metrics-paginated', JSON.stringify(queryParams)],
		(inst) => query_comprehensive_metrics(inst, 3600000, queryParams),
		instance
	);
};
