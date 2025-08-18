//---------------------------------------------------------
// Alert Management Hooks
//---------------------------------------------------------
import {useQueryInstanceData} from 'hooks/query/common';
import {
	query_create_alert_rule,
	query_list_alert_rules,
	query_get_alert_rule,
	query_update_alert_rule,
	query_delete_alert_rule,
	query_get_all_alerts_main,
	query_create_manual_alert,
	query_get_all_alerts,
	query_get_active_alerts,
	query_alert_stats,
	query_resolve_alert,
	query_resolve_alert_put,
	query_get_alert,
	query_get_alerts_by_metric,
} from 'connector/instance/alerts';
import {
	ICreateAlertRuleRequest,
	ICreateManualAlertRequest,
	IUpdateAlertRuleRequest,
	IAlertRuleResponse,
	IAlertRulesListResponse,
	IActiveAlertsResponse,
	IAllAlertsResponse,
	IAlertListResponse,
	IAlertStatsResponse,
	IResolveAlertRequest,
	IResolveAlertResponse,
	IAlertResponse,
	IAlertCreatedResponse,
	IDeleteResponse,
	IAlertRuleQueryParams,
	IAlertQueryParams,
} from 'types/alerts';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Alert Rules Management Hooks
//---------------------------------------------------------

/**
 * Hook for listing alert rules with optional filters
 */
export const useAlertRules = (instance: IInstance | null, params?: IAlertRuleQueryParams) => {
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
		false, // not infinity
		false  // not common data
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

//---------------------------------------------------------
// Alerts Management Hooks
//---------------------------------------------------------

/**
 * Hook for getting all alerts (main listing endpoint)
 */
export const useAllAlertsMain = (instance: IInstance | null, params?: IAlertQueryParams) => {
	return useQueryInstanceData(
		['all-alerts-main', JSON.stringify(params || {})],
		(inst) => query_get_all_alerts_main(inst, params),
		instance
	);
};

/**
 * Hook for getting all alerts (alternative endpoint)
 */
export const useAllAlerts = (instance: IInstance | null, params?: IAlertQueryParams) => {
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
		false, // not infinity
		false  // not common data
	);
};

//---------------------------------------------------------
// Alert Management Action Functions
//---------------------------------------------------------

/**
 * Action function to create an alert rule
 */
export const createAlertRule = async (instance: IInstance, request: ICreateAlertRuleRequest): Promise<IAlertRuleResponse> => {
	return query_create_alert_rule(instance, request);
};

/**
 * Action function to create a manual alert
 */
export const createManualAlert = async (instance: IInstance, request: ICreateManualAlertRequest): Promise<IAlertCreatedResponse> => {
	return query_create_manual_alert(instance, request);
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
 * Action function to resolve alerts (POST method)
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

//---------------------------------------------------------
// Convenience Hooks with Pre-configured Filters
//---------------------------------------------------------

/**
 * Hook for getting enabled alert rules only
 */
export const useEnabledAlertRules = (instance: IInstance | null) => {
	return useAlertRules(instance, { enabled: true });
};

/**
 * Hook for getting disabled alert rules only
 */
export const useDisabledAlertRules = (instance: IInstance | null) => {
	return useAlertRules(instance, { enabled: false });
};

/**
 * Hook for getting critical alerts only
 */
export const useCriticalAlerts = (instance: IInstance | null) => {
	return useAllAlertsMain(instance, { severity: 'critical' });
};

/**
 * Hook for getting alerts by specific status
 */
export const useAlertsByStatus = (instance: IInstance | null, status: 'active' | 'resolved') => {
	return useAllAlertsMain(instance, { status });
};

/**
 * Hook for getting alert rules by severity
 */
export const useAlertRulesBySeverity = (instance: IInstance | null, severity: 'critical' | 'warning' | 'info') => {
	return useAlertRules(instance, { severity });
};

/**
 * Hook for getting alert rules for a specific metric
 */
export const useAlertRulesForMetric = (instance: IInstance | null, metricName: string) => {
	return useAlertRules(instance, { metric_name: metricName });
};
