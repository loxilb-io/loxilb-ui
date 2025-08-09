//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQueryInstanceData} from 'hooks/query/common';
import {
	query_advanced_live_metrics,
	query_get_cache_stats,
	query_get_live_metrics,
	query_get_metric_history,
	query_get_metric_value,
	query_historical_metrics,
	query_metrics_aggregate,
	query_metrics_database,
	query_metrics_health,
	query_unified_metrics,
	// Backup Management
	query_create_backup,
	query_list_backups,
	query_restore_backup,
	query_backup_stats,
	// Compression Management
	query_run_compression,
	query_compression_stats,
	query_compression_candidates,
	query_compression_estimate,
	// Alert Management
	query_create_alert_rule,
	query_list_alert_rules,
	query_get_alert_rule,
	query_update_alert_rule,
	query_delete_alert_rule,
	query_get_all_alerts,
	query_get_active_alerts,
	query_alert_stats,
	query_resolve_alert,
	query_resolve_alert_put,
	query_get_alert,
	query_get_alerts_by_metric,
} from 'connector/instance/metrics';
import {
	ICacheStatsResponse,
	IHealthResponse,
	IHistoricalMetricsParams,
	ILiveMetricsResponse,
	IMetricHistoryResponse,
	IMetricValueResponse,
	IMetricsAggregateParams,
	IMetricsQueryParams,
	IQueryResponse,
	IUnifiedMetricsParams,
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

//---------------------------------------------------------
// Hooks for Advanced Metrics API
//---------------------------------------------------------

/**
 * Hook for live metrics from cache
 */
export const useLiveMetrics = (instance: IInstance | null, phase: 1 | 2 = 2) => {
	return useQueryInstanceData(
		['live-metrics', phase.toString()],
		(inst) => query_get_live_metrics(inst, phase),
		instance
	);
};

/**
 * Hook for advanced live metrics
 */
export const useAdvancedLiveMetrics = (instance: IInstance | null, phase: 1 | 2 = 2, metrics?: string) => {
	return useQueryInstanceData(
		['advanced-live-metrics', phase.toString(), metrics || 'all'],
		(inst) => query_advanced_live_metrics(inst, phase, metrics),
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
export const useSystemHealth = (instance: IInstance | null) => {
	return useQueryInstanceData(['system-health'], query_metrics_health, instance);
};

/**
 * Hook for metric history
 */
export const useMetricHistory = (instance: IInstance | null, metricName: string, count: number = 10) => {
	return useQueryInstanceData(
		['metric-history', metricName, count.toString()],
		(inst) => query_get_metric_history(inst, metricName, count),
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
// Backup Management Hooks
//---------------------------------------------------------

/**
 * Hook for listing all available backups
 */
export const useBackupList = (instance: IInstance | null) => {
	return useQueryInstanceData(['backup-list'], query_list_backups, instance);
};

/**
 * Hook for backup system statistics
 */
export const useBackupStats = (instance: IInstance | null) => {
	return useQueryInstanceData(['backup-stats'], query_backup_stats, instance);
};

/**
 * Action function to create a backup
 */
export const createBackup = async (instance: IInstance, request?: ICreateBackupRequest): Promise<IBackupResponse> => {
	return query_create_backup(instance, request);
};

/**
 * Action function to restore from backup
 */
export const restoreBackup = async (instance: IInstance, request: IRestoreBackupRequest): Promise<IRestoreResponse> => {
	return query_restore_backup(instance, request);
};

//---------------------------------------------------------
// Compression Management Hooks
//---------------------------------------------------------

/**
 * Hook for compression system statistics
 */
export const useCompressionStats = (instance: IInstance | null) => {
	return useQueryInstanceData(['compression-stats'], query_compression_stats, instance);
};

/**
 * Hook for compression candidates analysis
 */
export const useCompressionCandidates = (instance: IInstance | null) => {
	return useQueryInstanceData(['compression-candidates'], query_compression_candidates, instance);
};

/**
 * Hook for compression savings estimate
 */
export const useCompressionEstimate = (instance: IInstance | null) => {
	return useQueryInstanceData(['compression-estimate'], query_compression_estimate, instance);
};

/**
 * Action function to run compression
 */
export const runCompression = async (instance: IInstance, request?: IRunCompressionRequest): Promise<ICompressionResponse> => {
	return query_run_compression(instance, request);
};

//---------------------------------------------------------
// Alert Management Hooks
//---------------------------------------------------------

/**
 * Hook for listing alert rules with optional filters
 */
export const useAlertRules = (instance: IInstance | null, params?: {
	enabled?: boolean;
	metric_name?: string;
	severity?: string;
	limit?: number;
	offset?: number;
}) => {
	return useQueryInstanceData(
		['alert-rules', JSON.stringify(params || {})],
		(inst) => query_list_alert_rules(inst, params),
		instance
	);
};

/**
 * Hook for getting a specific alert rule
 */
export const useAlertRule = (instance: IInstance | null, ruleId: string) => {
	return useQueryInstanceData(
		['alert-rule', ruleId],
		(inst) => query_get_alert_rule(inst, ruleId),
		instance,
		false,
		false
	);
};

/**
 * Hook for getting all alerts with optional filters
 */
export const useAllAlerts = (instance: IInstance | null, params?: {
	status?: string;
	severity?: string;
	rule_name?: string;
	metric_name?: string;
	limit?: number;
	offset?: number;
}) => {
	return useQueryInstanceData(
		['all-alerts', JSON.stringify(params || {})],
		(inst) => query_get_all_alerts(inst, params),
		instance
	);
};

/**
 * Hook for getting active alerts
 */
export const useActiveAlerts = (instance: IInstance | null) => {
	return useQueryInstanceData(['active-alerts'], query_get_active_alerts, instance);
};

/**
 * Hook for alert system statistics
 */
export const useAlertStats = (instance: IInstance | null) => {
	return useQueryInstanceData(['alert-stats'], query_alert_stats, instance);
};

/**
 * Hook for getting a specific alert
 */
export const useAlert = (instance: IInstance | null, alertId: string) => {
	return useQueryInstanceData(
		['alert', alertId],
		(inst) => query_get_alert(inst, alertId),
		instance,
		false,
		false
	);
};

/**
 * Hook for getting alerts by metric name
 */
export const useAlertsByMetric = (instance: IInstance | null, metricName: string) => {
	return useQueryInstanceData(
		['alerts-by-metric', metricName],
		(inst) => query_get_alerts_by_metric(inst, metricName),
		instance
	);
};

/**
 * Action function to create an alert rule
 */
export const createAlertRule = async (instance: IInstance, request: ICreateAlertRuleRequest): Promise<IAlertRuleResponse> => {
	return query_create_alert_rule(instance, request);
};

/**
 * Action function to update an alert rule
 */
export const updateAlertRule = async (instance: IInstance, ruleId: string, request: IUpdateAlertRuleRequest): Promise<IAlertRuleResponse> => {
	return query_update_alert_rule(instance, ruleId, request);
};

/**
 * Action function to delete an alert rule
 */
export const deleteAlertRule = async (instance: IInstance, ruleId: string): Promise<IDeleteResponse> => {
	return query_delete_alert_rule(instance, ruleId);
};

/**
 * Action function to resolve alerts
 */
export const resolveAlert = async (instance: IInstance, request: IResolveAlertRequest): Promise<IResolveAlertResponse> => {
	return query_resolve_alert(instance, request);
};

/**
 * Action function to resolve alerts (PUT method)
 */
export const resolveAlertPut = async (instance: IInstance, request: IResolveAlertRequest): Promise<IResolveAlertResponse> => {
	return query_resolve_alert_put(instance, request);
};
