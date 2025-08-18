//---------------------------------------------------------
// Alert Management API Connector Functions
//---------------------------------------------------------
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
import {GET_INST, POST_INST, PUT_INST, DELETE_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Alert Rules Management
//---------------------------------------------------------

/**
 * Create a new alert rule
 * @param instance - LoxiLB instance
 * @param request - Alert rule creation parameters
 */
export async function query_create_alert_rule(instance: IInstance, request: ICreateAlertRuleRequest): Promise<IAlertRuleResponse> {
	const resp = await POST_INST(instance, `/api/v1/alerts/rules`, request);
	return (resp.data as IAlertRuleResponse) ?? {};
}

/**
 * List alert rules with optional filters
 * @param instance - LoxiLB instance
 * @param params - Optional filter parameters
 */
export async function query_list_alert_rules(instance: IInstance, params?: IAlertRuleQueryParams): Promise<IAlertRulesListResponse> {
	// Filter out undefined values from params
	const filteredParams = params ? Object.fromEntries(
		Object.entries(params).filter(([_, value]) => value !== undefined)
	) : undefined;
	
	const resp = await GET_INST(instance, `/api/v1/alerts/rules`, filteredParams);
	return (resp.data as IAlertRulesListResponse) ?? {};
}

/**
 * Get specific alert rule
 * @param instance - LoxiLB instance
 * @param ruleId - The unique identifier of the alert rule
 */
export async function query_get_alert_rule(instance: IInstance, ruleId: string): Promise<IAlertRuleResponse> {
	const resp = await GET_INST(instance, `/api/v1/alerts/rules/${ruleId}`);
	return (resp.data as IAlertRuleResponse) ?? {};
}

/**
 * Update alert rule
 * @param instance - LoxiLB instance
 * @param ruleId - The unique identifier of the alert rule
 * @param request - Updated alert rule parameters
 */
export async function query_update_alert_rule(instance: IInstance, ruleId: string, request: IUpdateAlertRuleRequest): Promise<IAlertRuleResponse> {
	const resp = await PUT_INST(instance, `/api/v1/alerts/rules/${ruleId}`, request);
	return (resp.data as IAlertRuleResponse) ?? {};
}

/**
 * Delete alert rule
 * @param instance - LoxiLB instance
 * @param ruleId - The unique identifier of the alert rule
 */
export async function query_delete_alert_rule(instance: IInstance, ruleId: string): Promise<IDeleteResponse> {
	const resp = await DELETE_INST(instance, `/api/v1/alerts/rules/${ruleId}`);
	return (resp.data as IDeleteResponse) ?? {};
}

//---------------------------------------------------------
// Alerts Management
//---------------------------------------------------------

/**
 * Get all alerts (main listing endpoint)
 * @param instance - LoxiLB instance
 * @param params - Optional filter parameters
 */
export async function query_get_all_alerts_main(instance: IInstance, params?: IAlertQueryParams): Promise<IAlertListResponse> {
	// Filter out undefined values from params
	const filteredParams = params ? Object.fromEntries(
		Object.entries(params).filter(([_, value]) => value !== undefined)
	) : undefined;
	
	const resp = await GET_INST(instance, `/api/v1/alerts`, filteredParams);
	return (resp.data as IAlertListResponse) ?? {};
}

/**
 * Create manual alert
 * @param instance - LoxiLB instance
 * @param request - Manual alert parameters
 */
export async function query_create_manual_alert(instance: IInstance, request: ICreateManualAlertRequest): Promise<IAlertCreatedResponse> {
	const resp = await POST_INST(instance, `/api/v1/alerts`, request);
	return (resp.data as IAlertCreatedResponse) ?? {};
}

/**
 * Get all alerts (alternative endpoint)
 * @param instance - LoxiLB instance
 * @param params - Optional filter parameters
 */
export async function query_get_all_alerts(instance: IInstance, params?: IAlertQueryParams): Promise<IAllAlertsResponse> {
	// Filter out undefined values from params
	const filteredParams = params ? Object.fromEntries(
		Object.entries(params).filter(([_, value]) => value !== undefined)
	) : undefined;
	
	const resp = await GET_INST(instance, `/api/v1/alerts/all`, filteredParams);
	return (resp.data as IAllAlertsResponse) ?? {};
}

/**
 * Get active alerts
 * @param instance - LoxiLB instance
 */
export async function query_get_active_alerts(instance: IInstance): Promise<IActiveAlertsResponse> {
	const resp = await GET_INST(instance, `/api/v1/alerts/active`);
	return (resp.data as IActiveAlertsResponse) ?? {};
}

/**
 * Get alert system statistics
 * @param instance - LoxiLB instance
 */
export async function query_alert_stats(instance: IInstance): Promise<IAlertStatsResponse> {
	const resp = await GET_INST(instance, `/api/v1/alerts/stats`);
	return (resp.data as IAlertStatsResponse) ?? {};
}

/**
 * Manually resolve alerts (POST method)
 * @param instance - LoxiLB instance
 * @param request - Alert resolution parameters
 */
export async function query_resolve_alert(instance: IInstance, request: IResolveAlertRequest): Promise<IResolveAlertResponse> {
	const resp = await POST_INST(instance, `/api/v1/alerts/resolve`, request);
	return (resp.data as IResolveAlertResponse) ?? {};
}

/**
 * Manually resolve alerts (PUT method)
 * @param instance - LoxiLB instance
 * @param request - Alert resolution parameters
 */
export async function query_resolve_alert_put(instance: IInstance, request: IResolveAlertRequest): Promise<IResolveAlertResponse> {
	const resp = await PUT_INST(instance, `/api/v1/alerts/resolve`, request);
	return (resp.data as IResolveAlertResponse) ?? {};
}

/**
 * Get specific alert by ID
 * @param instance - LoxiLB instance
 * @param alertId - The unique identifier of the alert
 */
export async function query_get_alert(instance: IInstance, alertId: string): Promise<IAlertResponse> {
	const resp = await GET_INST(instance, `/api/v1/alerts/alert/${alertId}`);
	return (resp.data as IAlertResponse) ?? {};
}

/**
 * Get alerts by metric name
 * @param instance - LoxiLB instance
 * @param metricName - The name of the metric
 */
export async function query_get_alerts_by_metric(instance: IInstance, metricName: string): Promise<IAlertRulesListResponse> {
	const resp = await GET_INST(instance, `/api/v1/alerts/metric/${metricName}`);
	return (resp.data as IAlertRulesListResponse) ?? {};
}
