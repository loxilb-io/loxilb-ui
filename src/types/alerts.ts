//---------------------------------------------------------
// Alert Management API Types
//---------------------------------------------------------

/**
 * Common Response Structure for LoxiLB API
 */
export interface ILoxiLBAPIResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data?: any;
}

/**
 * Error Response
 */
export interface IErrorResponse {
	success: boolean;
	message: string;
	timestamp: number;
	error: string;
	details?: string;
}

/**
 * Create Alert Rule Request
 */
export interface ICreateAlertRuleRequest {
	name: string;
	metric_name: string;
	condition: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
	threshold: number;
	duration?: number;
	severity: 'critical' | 'warning' | 'info';
	message?: string;
	enabled?: boolean;
}

/**
 * Create Manual Alert Request
 */
export interface ICreateManualAlertRequest {
	rule_name?: string;
	metric_name: string;
	severity: 'critical' | 'warning' | 'info';
	message: string;
	value?: number;
	threshold?: number;
	labels?: Record<string, string>;
}

/**
 * Update Alert Rule Request
 */
export interface IUpdateAlertRuleRequest {
	name?: string;
	metric_name?: string;
	condition?: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
	threshold?: number;
	duration?: number;
	severity?: 'critical' | 'warning' | 'info';
	message?: string;
	enabled?: boolean;
}

/**
 * Alert Rule
 */
export interface IAlertRule {
	id: string;
	rule_id?: string;  // API also returns this field
	name: string;
	rule_name?: string;  // API also returns this field
	metric_name: string;
	condition: string;
	threshold: number;
	duration: number;
	severity: string;
	message: string;
	enabled: boolean;
	created_at: number;
	updated_at: number;
	status?: string;  // API may return this field
	value?: number;  // Current metric value from API
	triggered_at?: number;  // When the alert was triggered
	first_breach?: number;  // First time threshold was breached
	last_seen?: number;  // Last time alert condition was checked
}

/**
 * Alert
 */
export interface IAlert {
	id: string;
	rule_id: string;
	rule_name: string;
	metric_name: string;
	status: 'active' | 'resolved' | 'firing';
	severity: string;
	message: string;
	value?: number;
	threshold?: number;
	triggered_at: number;
	resolved_at?: number;
	resolved_by?: string;
	reason?: string;
	labels?: Record<string, string>;
}

/**
 * Alert Rule Response
 */
export interface IAlertRuleResponse extends ILoxiLBAPIResponse {
	data: IAlertRule;
}

/**
 * Alert Rules List Response
 */
export interface IAlertRulesListResponse extends ILoxiLBAPIResponse {
	data: IAlertRule[];
	pagination?: {
		total: number;
		offset: number;
		limit: number;
		has_more: boolean;
	};
}

/**
 * Alert Response (single alert)
 */
export interface IAlertResponse extends ILoxiLBAPIResponse {
	data: IAlert;
}

/**
 * Alert Created Response
 */
export interface IAlertCreatedResponse extends ILoxiLBAPIResponse {
	data: {
		alert_id: string;
		created_at: number;
	};
}

/**
 * Alert List Response (main listing endpoint)
 */
export interface IAlertListResponse extends ILoxiLBAPIResponse {
	data: IAlert[];
	pagination?: {
		total: number;
		offset: number;
		limit: number;
		has_more: boolean;
	};
}

/**
 * Active Alerts Response
 */
export interface IActiveAlertsResponse extends ILoxiLBAPIResponse {
	data: IAlert[];
}

/**
 * All Alerts Response
 */
export interface IAllAlertsResponse extends ILoxiLBAPIResponse {
	data: IAlert[];
	pagination?: {
		total: number;
		offset: number;
		limit: number;
		has_more: boolean;
	};
}

/**
 * Alert Stats Response
 */
export interface IAlertStatsResponse extends ILoxiLBAPIResponse {
	data: {
		total_rules: number;
		enabled_rules: number;
		disabled_rules: number;
		active_alerts: number;
		resolved_alerts: number;
		alert_frequencies: Record<string, number>;
		severity_distribution: Record<string, number>;
		system_performance: {
			avg_response_time_ms: number;
			rule_evaluation_rate: number;
			last_evaluation: number;
		};
	};
}

/**
 * Resolve Alert Request
 */
export interface IResolveAlertRequest {
	alert_id?: string;
	rule_name?: string;
	reason?: string;
	resolved_by?: string;
}

/**
 * Resolve Alert Response
 */
export interface IResolveAlertResponse extends ILoxiLBAPIResponse {
	data: {
		resolved_count: number;
		resolved_alerts: string[];
		failed_alerts?: string[];
	};
}

/**
 * Delete Response
 */
export interface IDeleteResponse extends ILoxiLBAPIResponse {
	data?: {
		deleted_at: number;
	};
}

/**
 * Alert Rule Query Parameters
 */
export interface IAlertRuleQueryParams {
	enabled?: boolean;
	metric_name?: string;
	severity?: 'critical' | 'warning' | 'info';
	limit?: number;
	offset?: number;
}

/**
 * Alert Query Parameters
 */
export interface IAlertQueryParams {
	status?: 'active' | 'resolved';
	severity?: 'critical' | 'warning' | 'info';
	rule_name?: string;
	metric_name?: string;
	limit?: number;
	offset?: number;
}
