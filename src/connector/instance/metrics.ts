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
	// Advanced Metrics Types
	ILiveMetricsResponse,
	ICacheStatsResponse,
	IMetricHistoryResponse,
	IMetricValueResponse,
	IQueryResponse,
	IHealthResponse,
	IMetricsQueryParams,
	IMetricsAggregateParams,
	IUnifiedMetricsParams,
	IHistoricalMetricsParams,
	// Backup Management Types
	ICreateBackupRequest,
	IBackupResponse,
	IBackupListResponse,
	IRestoreBackupRequest,
	IRestoreResponse,
	IBackupStatsResponse,
	// Compression Management Types
	IRunCompressionRequest,
	ICompressionResponse,
	ICompressionStatsResponse,
	ICompressionCandidatesResponse,
	ICompressionEstimateResponse,
	// Alert Management Types
	ICreateAlertRuleRequest,
	IUpdateAlertRuleRequest,
	IAlertRuleResponse,
	IAlertRulesListResponse,
	IActiveAlertsResponse,
	IAllAlertsResponse,
	IAlertStatsResponse,
	IResolveAlertRequest,
	IResolveAlertResponse,
	IAlertResponse,
	IDeleteResponse,
} from 'types/metrics';
import {IInstance} from 'types/oam';
import {GET_INST, POST_INST, PUT_INST, DELETE_INST} from '../fetcher/fetcher_inst';

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

//---------------------------------------------------------
// Advanced Metrics API Functions (New)
//---------------------------------------------------------

/**
 * Get real-time metrics from cache
 * @param instance - LoxiLB instance
 * @param phase - Metrics phase (1: Critical only, 2: Critical + Important)
 */
export async function query_get_live_metrics(instance: IInstance, phase: 1 | 2 = 2): Promise<ILiveMetricsResponse> {
	const resp = await GET_INST(instance, `/metrics/live`, { phase });
	return (resp.data as ILiveMetricsResponse) ?? {};
}

/**
 * Get metrics cache statistics
 * @param instance - LoxiLB instance
 */
export async function query_get_cache_stats(instance: IInstance): Promise<ICacheStatsResponse> {
	const resp = await GET_INST(instance, `/metrics/cache/stats`);
	return (resp.data as ICacheStatsResponse) ?? {};
}

/**
 * Get historical data for a specific metric
 * @param instance - LoxiLB instance
 * @param metricName - Name of the metric
 * @param count - Number of historical entries (1-1000)
 */
export async function query_get_metric_history(instance: IInstance, metricName: string, count: number = 10): Promise<IMetricHistoryResponse> {
	const resp = await GET_INST(instance, `/metrics/history/${metricName}`, { count });
	return (resp.data as IMetricHistoryResponse) ?? {};
}

/**
 * Get latest value for a specific metric
 * @param instance - LoxiLB instance
 * @param metricName - Name of the metric
 */
export async function query_get_metric_value(instance: IInstance, metricName: string): Promise<IMetricValueResponse> {
	const resp = await GET_INST(instance, `/metrics/value/${metricName}`);
	return (resp.data as IMetricValueResponse) ?? {};
}

/**
 * Query historical metrics from database
 * @param instance - LoxiLB instance
 * @param params - Query parameters
 */
export async function query_metrics_database(instance: IInstance, params: IMetricsQueryParams): Promise<IQueryResponse> {
	const resp = await GET_INST(instance, `/metrics/db/query`, params);
	return (resp.data as IQueryResponse) ?? {};
}

/**
 * Execute aggregation queries on metrics
 * @param instance - LoxiLB instance
 * @param params - Aggregation parameters
 */
export async function query_metrics_aggregate(instance: IInstance, params: IMetricsAggregateParams): Promise<IQueryResponse> {
	const resp = await GET_INST(instance, `/metrics/db/aggregate`, params);
	return (resp.data as IQueryResponse) ?? {};
}

/**
 * Unified intelligent metrics query
 * @param instance - LoxiLB instance
 * @param params - Unified query parameters
 */
export async function query_unified_metrics(instance: IInstance, params: IUnifiedMetricsParams): Promise<ILiveMetricsResponse | IQueryResponse> {
	const resp = await GET_INST(instance, `/metrics/query`, params);
	return resp.data ?? {};
}

/**
 * Get historical metrics (database-only)
 * @param instance - LoxiLB instance
 * @param params - Historical query parameters
 */
export async function query_historical_metrics(instance: IInstance, params: IHistoricalMetricsParams): Promise<IQueryResponse> {
	const resp = await GET_INST(instance, `/metrics/historical`, params);
	return (resp.data as IQueryResponse) ?? {};
}

/**
 * Get advanced live metrics (cache-only)
 * @param instance - LoxiLB instance
 * @param phase - Metrics phase
 * @param metrics - Filter specific metrics
 */
export async function query_advanced_live_metrics(instance: IInstance, phase: 1 | 2 = 2, metrics?: string): Promise<ILiveMetricsResponse> {
	const params: any = { phase };
	if (metrics) params.metrics = metrics;
	
	const resp = await GET_INST(instance, `/metrics/live/advanced`, params);
	return (resp.data as ILiveMetricsResponse) ?? {};
}

/**
 * Get metrics system health
 * @param instance - LoxiLB instance
 */
export async function query_metrics_health(instance: IInstance): Promise<IHealthResponse> {
	const resp = await GET_INST(instance, `/metrics/health`);
	return (resp.data as IHealthResponse) ?? {};
}

//---------------------------------------------------------
// Backup Management API Functions
//---------------------------------------------------------

/**
 * Create a new backup
 * @param instance - LoxiLB instance
 * @param request - Backup creation parameters
 */
export async function query_create_backup(instance: IInstance, request?: ICreateBackupRequest): Promise<IBackupResponse> {
	const resp = await POST_INST(instance, `/backup/create`, request);
	return (resp.data as IBackupResponse) ?? {};
}

/**
 * List all available backups
 * @param instance - LoxiLB instance
 */
export async function query_list_backups(instance: IInstance): Promise<IBackupListResponse> {
	const resp = await GET_INST(instance, `/backup/list`);
	return (resp.data as IBackupListResponse) ?? {};
}

/**
 * Restore from backup
 * @param instance - LoxiLB instance
 * @param request - Backup restoration parameters
 */
export async function query_restore_backup(instance: IInstance, request: IRestoreBackupRequest): Promise<IRestoreResponse> {
	const resp = await POST_INST(instance, `/backup/restore`, request);
	return (resp.data as IRestoreResponse) ?? {};
}

/**
 * Get backup system statistics
 * @param instance - LoxiLB instance
 */
export async function query_backup_stats(instance: IInstance): Promise<IBackupStatsResponse> {
	const resp = await GET_INST(instance, `/backup/stats`);
	return (resp.data as IBackupStatsResponse) ?? {};
}

//---------------------------------------------------------
// Compression Management API Functions
//---------------------------------------------------------

/**
 * Run data compression
 * @param instance - LoxiLB instance
 * @param request - Compression operation parameters
 */
export async function query_run_compression(instance: IInstance, request?: IRunCompressionRequest): Promise<ICompressionResponse> {
	const resp = await POST_INST(instance, `/compression/run`, request);
	return (resp.data as ICompressionResponse) ?? {};
}

/**
 * Get compression system statistics
 * @param instance - LoxiLB instance
 */
export async function query_compression_stats(instance: IInstance): Promise<ICompressionStatsResponse> {
	const resp = await GET_INST(instance, `/compression/stats`);
	return (resp.data as ICompressionStatsResponse) ?? {};
}

/**
 * Get compression candidates analysis
 * @param instance - LoxiLB instance
 */
export async function query_compression_candidates(instance: IInstance): Promise<ICompressionCandidatesResponse> {
	const resp = await GET_INST(instance, `/compression/candidates`);
	return (resp.data as ICompressionCandidatesResponse) ?? {};
}

/**
 * Get compression savings estimate
 * @param instance - LoxiLB instance
 */
export async function query_compression_estimate(instance: IInstance): Promise<ICompressionEstimateResponse> {
	const resp = await GET_INST(instance, `/compression/estimate`);
	return (resp.data as ICompressionEstimateResponse) ?? {};
}

//---------------------------------------------------------
// Alert Management API Functions
//---------------------------------------------------------

/**
 * Create a new alert rule
 * @param instance - LoxiLB instance
 * @param request - Alert rule creation parameters
 */
export async function query_create_alert_rule(instance: IInstance, request: ICreateAlertRuleRequest): Promise<IAlertRuleResponse> {
	const resp = await POST_INST(instance, `/alerts/rules`, request);
	return (resp.data as IAlertRuleResponse) ?? {};
}

/**
 * List alert rules
 * @param instance - LoxiLB instance
 * @param params - Optional filter parameters
 */
export async function query_list_alert_rules(instance: IInstance, params?: {
	enabled?: boolean;
	metric_name?: string;
	severity?: string;
	limit?: number;
	offset?: number;
}): Promise<IAlertRulesListResponse> {
	const resp = await GET_INST(instance, `/alerts/rules`, params);
	return (resp.data as IAlertRulesListResponse) ?? {};
}

/**
 * Get specific alert rule
 * @param instance - LoxiLB instance
 * @param ruleId - The unique identifier of the alert rule
 */
export async function query_get_alert_rule(instance: IInstance, ruleId: string): Promise<IAlertRuleResponse> {
	const resp = await GET_INST(instance, `/alerts/rules/${ruleId}`);
	return (resp.data as IAlertRuleResponse) ?? {};
}

/**
 * Update alert rule
 * @param instance - LoxiLB instance
 * @param ruleId - The unique identifier of the alert rule
 * @param request - Updated alert rule parameters
 */
export async function query_update_alert_rule(instance: IInstance, ruleId: string, request: IUpdateAlertRuleRequest): Promise<IAlertRuleResponse> {
	const resp = await PUT_INST(instance, `/alerts/rules/${ruleId}`, request);
	return (resp.data as IAlertRuleResponse) ?? {};
}

/**
 * Delete alert rule
 * @param instance - LoxiLB instance
 * @param ruleId - The unique identifier of the alert rule
 */
export async function query_delete_alert_rule(instance: IInstance, ruleId: string): Promise<IDeleteResponse> {
	const resp = await DELETE_INST(instance, `/alerts/rules/${ruleId}`);
	return (resp.data as IDeleteResponse) ?? {};
}

/**
 * Get all alerts
 * @param instance - LoxiLB instance
 * @param params - Optional filter parameters
 */
export async function query_get_all_alerts(instance: IInstance, params?: {
	status?: string;
	severity?: string;
	rule_name?: string;
	metric_name?: string;
	limit?: number;
	offset?: number;
}): Promise<IAllAlertsResponse> {
	const resp = await GET_INST(instance, `/alerts/all`, params);
	return (resp.data as IAllAlertsResponse) ?? {};
}

/**
 * Get active alerts
 * @param instance - LoxiLB instance
 */
export async function query_get_active_alerts(instance: IInstance): Promise<IActiveAlertsResponse> {
	const resp = await GET_INST(instance, `/alerts/active`);
	return (resp.data as IActiveAlertsResponse) ?? {};
}

/**
 * Get alert system statistics
 * @param instance - LoxiLB instance
 */
export async function query_alert_stats(instance: IInstance): Promise<IAlertStatsResponse> {
	const resp = await GET_INST(instance, `/alerts/stats`);
	return (resp.data as IAlertStatsResponse) ?? {};
}

/**
 * Manually resolve alerts
 * @param instance - LoxiLB instance
 * @param request - Alert resolution parameters
 */
export async function query_resolve_alert(instance: IInstance, request: IResolveAlertRequest): Promise<IResolveAlertResponse> {
	const resp = await POST_INST(instance, `/alerts/resolve`, request);
	return (resp.data as IResolveAlertResponse) ?? {};
}

/**
 * Manually resolve alerts (PUT method)
 * @param instance - LoxiLB instance
 * @param request - Alert resolution parameters
 */
export async function query_resolve_alert_put(instance: IInstance, request: IResolveAlertRequest): Promise<IResolveAlertResponse> {
	const resp = await PUT_INST(instance, `/alerts/resolve`, request);
	return (resp.data as IResolveAlertResponse) ?? {};
}

/**
 * Get specific alert by ID
 * @param instance - LoxiLB instance
 * @param alertId - The unique identifier of the alert
 */
export async function query_get_alert(instance: IInstance, alertId: string): Promise<IAlertResponse> {
	const resp = await GET_INST(instance, `/alerts/alert/${alertId}`);
	return (resp.data as IAlertResponse) ?? {};
}

/**
 * Get alerts by metric name
 * @param instance - LoxiLB instance
 * @param metricName - The name of the metric
 */
export async function query_get_alerts_by_metric(instance: IInstance, metricName: string): Promise<IAlertRulesListResponse> {
	const resp = await GET_INST(instance, `/alerts/metric/${metricName}`);
	return (resp.data as IAlertRulesListResponse) ?? {};
}
