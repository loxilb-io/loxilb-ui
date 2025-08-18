//---------------------------------------------------------
// Advanced Metrics API Connector Functions
//---------------------------------------------------------
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
	IAdvancedMetricsQueryParams,
} from 'types/advancedMetrics';
import {IInstance} from 'types/oam';
import {GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Live Metrics API Functions
//---------------------------------------------------------

/**
 * Get live metrics data
 * @param instance - LoxiLB instance
 * @param phase - Metrics loading phase (1 for critical, 2 for all)
 * @param metricNames - Comma-separated list of metric names to retrieve
 * @param format - Response format (json or prometheus)
 */
export async function query_get_live_metrics(
	instance: IInstance, 
	phase: 1 | 2 = 2,
	metricNames?: string,
	format?: 'json' | 'prometheus'
): Promise<ILiveMetricsResponse> {
	const params: any = { phase };
	if (metricNames) params.metric_names = metricNames;
	if (format) params.format = format;
	
	const resp = await GET_INST(instance, `/api/v1/metrics/live`, params);
	return (resp.data as ILiveMetricsResponse) ?? {};
}

/**
 * Get cache statistics
 * @param instance - LoxiLB instance
 */
export async function query_get_cache_stats(instance: IInstance): Promise<ICacheStatsResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/cache/stats`);
	return (resp.data as ICacheStatsResponse) ?? {};
}

/**
 * Get metric history
 * @param instance - LoxiLB instance
 * @param metricName - Name of the metric
 * @param startTime - Start timestamp (Unix epoch)
 * @param endTime - End timestamp (Unix epoch)
 * @param interval - Aggregation interval in seconds
 */
export async function query_get_metric_history(
	instance: IInstance, 
	metricName: string,
	startTime?: number,
	endTime?: number,
	interval?: number
): Promise<IMetricHistoryResponse> {
	const params: any = {};
	if (startTime) params.start_time = startTime;
	if (endTime) params.end_time = endTime;
	if (interval) params.interval = interval;
	
	const resp = await GET_INST(instance, `/api/v1/metrics/history/${metricName}`, params);
	return (resp.data as IMetricHistoryResponse) ?? {};
}

/**
 * Get current metric value
 * @param instance - LoxiLB instance
 * @param metricName - Name of the metric
 */
export async function query_get_metric_value(instance: IInstance, metricName: string): Promise<IMetricValueResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/value/${metricName}`);
	return (resp.data as IMetricValueResponse) ?? {};
}

//---------------------------------------------------------
// Database Query API Functions
//---------------------------------------------------------

/**
 * Query historical metrics from database
 * @param instance - LoxiLB instance
 * @param params - Database query parameters
 */
export async function query_metrics_database(instance: IInstance, params: IMetricsQueryParams): Promise<IQueryResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/db/query`, params);
	return (resp.data as IQueryResponse) ?? {};
}

/**
 * Get aggregated metrics from database
 * @param instance - LoxiLB instance
 * @param params - Aggregation query parameters
 */
export async function query_metrics_aggregate(instance: IInstance, params: IMetricsAggregateParams): Promise<IAggregatedMetricsResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/db/aggregate`, params);
	return (resp.data as IAggregatedMetricsResponse) ?? {};
}

/**
 * Batch query multiple metrics
 * @param instance - LoxiLB instance
 * @param request - Batch query parameters
 */
export async function query_metrics_batch(instance: IInstance, request: IBatchQueryRequest): Promise<IBatchQueryResponse> {
	const resp = await POST_INST(instance, `/api/v1/metrics/db/batch`, request);
	return (resp.data as IBatchQueryResponse) ?? {};
}

//---------------------------------------------------------
// Unified Metrics API Functions (Smart Routing)
//---------------------------------------------------------

/**
 * Unified metrics query with smart routing
 * @param instance - LoxiLB instance
 * @param params - Unified query parameters
 */
export async function query_unified_metrics(instance: IInstance, params: IUnifiedMetricsParams): Promise<IUnifiedQueryResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/query`, params);
	return (resp.data as IUnifiedQueryResponse) ?? {};
}

/**
 * Historical metrics (database-only)
 * @param instance - LoxiLB instance
 * @param params - Historical metrics parameters
 */
export async function query_historical_metrics(instance: IInstance, params: IHistoricalMetricsParams): Promise<IHistoricalMetricsResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/historical`, params);
	return (resp.data as IHistoricalMetricsResponse) ?? {};
}

/**
 * Get advanced live metrics (cache-only)
 * @param instance - LoxiLB instance
 * @param phase - Metrics loading phase
 * @param metrics - Filter specific metrics
 * @param format - Response format (json or prometheus)
 */
export async function query_advanced_live_metrics(
	instance: IInstance, 
	phase: 1 | 2 = 2, 
	metrics?: string,
	format?: 'json' | 'prometheus'
): Promise<IAdvancedLiveMetricsResponse> {
	const params: any = { phase };
	if (metrics) params.metrics = metrics;
	if (format) params.format = format;
	
	const resp = await GET_INST(instance, `/api/v1/metrics/live/advanced`, params);
	return (resp.data as IAdvancedLiveMetricsResponse) ?? {};
}

/**
 * Get metrics system health check
 * @param instance - LoxiLB instance
 */
export async function query_metrics_health(instance: IInstance): Promise<IMetricsHealthResponse> {
	const resp = await GET_INST(instance, `/api/v1/metrics/health`);
	return (resp.data as IMetricsHealthResponse) ?? {};
}

//---------------------------------------------------------
// Enhanced Advanced Metrics Functions
//---------------------------------------------------------

/**
 * Get critical metrics only (priority-based filtering)
 * @param instance - LoxiLB instance
 * @param params - Advanced metrics query parameters
 */
export async function query_critical_metrics(
	instance: IInstance, 
	params?: IAdvancedMetricsQueryParams
): Promise<ILiveMetricsResponse> {
	const criticalParams = {
		...params,
		priorities: 'critical',
		phase: 1
	};
	return query_get_live_metrics(instance, 1, criticalParams.metrics);
}

/**
 * Get metrics by category
 * @param instance - LoxiLB instance
 * @param categories - Comma-separated list of categories
 * @param params - Additional query parameters
 */
export async function query_metrics_by_category(
	instance: IInstance, 
	categories: string,
	params?: IAdvancedMetricsQueryParams
): Promise<ILiveMetricsResponse> {
	const categoryParams = {
		...params,
		categories,
	};
	return query_get_live_metrics(instance, 2, categoryParams.metrics);
}

/**
 * Get comprehensive metrics for dashboard (all priorities)
 * @param instance - LoxiLB instance
 * @param timeRange - Time range in milliseconds from now
 * @param params - Additional query parameters
 */
export async function query_comprehensive_metrics(
	instance: IInstance,
	timeRange: number = 3600000, // Default 1 hour
	params?: IAdvancedMetricsQueryParams
): Promise<{
	live: ILiveMetricsResponse;
	historical: IHistoricalMetricsResponse;
	cache_stats: ICacheStatsResponse;
}> {
	const endTime = Math.floor(Date.now() / 1000);
	const startTime = endTime - Math.floor(timeRange / 1000);

	const [live, historical, cacheStats] = await Promise.all([
		query_get_live_metrics(instance, 2, params?.metrics),
		query_historical_metrics(instance, {
			time_start: startTime,
			time_end: endTime,
			metrics: params?.metrics
		}),
		query_get_cache_stats(instance)
	]);

	return {
		live,
		historical, 
		cache_stats: cacheStats
	};
}
