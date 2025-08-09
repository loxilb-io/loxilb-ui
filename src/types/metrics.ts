//---------------------------------------------------------
// Interfaces for /metrics/flowcount
//---------------------------------------------------------
export interface INetworkFlowStats {
	active_conntrack_count: number;
	active_flow_count_tcp: number;
	active_flow_count_udp: number;
	active_flow_count_sctp: number;
	inactive_flow_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/hostcount
//---------------------------------------------------------
export interface IHostCount {
	healthy_host_count: number;
	unhealthy_host_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/lbrulecount
//---------------------------------------------------------
export interface ILBRuleCount {
	lb_rule_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/newflowcount
//---------------------------------------------------------
export interface INewFlowCount {
	new_flow_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/requestcount
//---------------------------------------------------------
export interface IRequestCountPerService {
	name: string;
	value: number;
}

export interface IRequestCount {
	total_requests?: number;
	total_requests_per_service?: IRequestCountPerService[];
}

//---------------------------------------------------------
// Interfaces for  /metrics/errorcount
//---------------------------------------------------------
export interface IErrorCountPerService {
	name: string;
	value: number;
}

export interface IErrorCount {
	total_errors?: number;
	total_errors_per_service: IErrorCountPerService[];
}

//---------------------------------------------------------
// Interfaces for /metrics/processedtraffic
//---------------------------------------------------------
export interface IProcessedTraffic {
	processed_bytes: number;
	processed_tcp_bytes: number;
	processed_sctp_bytes: number;
	processed_udp_bytes: number;
	processed_packets: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/lbprocessedtraffic
//---------------------------------------------------------
export interface ILbRuleInteractionItem {
	service: string;
	sip: string;
	dip: string;
	value: number;
}

export interface ILBProcessedTraffic {
	lb_rule_interaction_bytes: ILbRuleInteractionItem[];
	lb_rule_interaction_packets: ILbRuleInteractionItem[];
}

//---------------------------------------------------------
// Interfaces for /metrics/epdisttraffic
//---------------------------------------------------------
export interface IEndpointDistributionEntry {
	dip: string;
	value: number;
	ratio: number;
}

export interface IEndpointDistributionTraffic {
	[key: string]: IEndpointDistributionEntry[];
}

//---------------------------------------------------------
// Interfaces for /metrics/servicedisttraffic
//---------------------------------------------------------
export interface IServiceDistTrafficEntry {
	value: number;
	ratio: number;
}

export interface IServiceDistTrafficData {
	[key: string]: IServiceDistTrafficEntry;
}

//---------------------------------------------------------
// Interfaces /metrics/fwdrops
//---------------------------------------------------------
export interface IFirewallRuleDrop {
	fw_rule: string;
	value: number;
}

export interface IFirewallDropReport {
	total_fw_drops?: number;
	total_fw_drops_per_rule: IFirewallRuleDrop[];
}

//---------------------------------------------------------
// Interfaces for /metrics/reqcountperclient
//---------------------------------------------------------
//{
//  "additionalProp1": 0,
//  "additionalProp2": 0,
//  "additionalProp3": 0
//}

export interface IRequestCountPerClient {
	[key: string]: number;
}

//---------------------------------------------------------
// Advanced Metrics API Types (New)
//---------------------------------------------------------

/**
 * Live Metrics Response from cache
 */
export interface ILiveMetricsResponse {
	timestamp: number;
	critical: Record<string, number>;
	important?: Record<string, number>;
	total_metrics: number;
	cache_enabled: boolean;
	response_time_ms: number;
	source: 'cache' | 'fallback';
	phase: 1 | 2;
}

/**
 * Cache Statistics Response
 */
export interface ICacheStatsResponse {
	enabled: boolean;
	total_buffers: number;
	total_memory_bytes: number;
	average_utilization: number;
	phase1_metrics_count: number;
	phase2_metrics_count: number;
	total_phases: number;
	last_cleanup: number;
	buffer_statistics: Record<string, any>;
}

/**
 * Metric History Entry
 */
export interface IMetricEntry {
	timestamp: number;
	value: number;
	category: string;
}

/**
 * Metric History Response
 */
export interface IMetricHistoryResponse {
	metric_name: string;
	category: string;
	entries: IMetricEntry[];
	count: number;
	time_range: string;
}

/**
 * Single Metric Value Response
 */
export interface IMetricValueResponse {
	metric_name: string;
	value: number;
	timestamp: number;
	age_ms: number;
}

/**
 * Metric Data Point for queries
 */
export interface IMetricDataPoint {
	timestamp: number;
	metric_name: string;
	value: number;
	labels?: Record<string, string>;
	service_name?: string;
}

/**
 * Database Query Response
 */
export interface IQueryResponse {
	data: IMetricDataPoint[];
	next_cursor?: string;
	has_more: boolean;
	total_count?: number;
	query_time: string;
}

/**
 * Health Check Response
 */
export interface IHealthResponse {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: number;
	cache_enabled: boolean;
	total_buffers: number;
	memory_usage_mb: number;
	average_utilization: number;
}

/**
 * Database Query Parameters
 */
export interface IMetricsQueryParams {
	time_start: number;
	time_end: number;
	metrics?: string;
	services?: string;
	cursor?: string;
	limit?: number;
	format?: 'json' | 'csv';
}

/**
 * Aggregation Query Parameters
 */
export interface IMetricsAggregateParams extends IMetricsQueryParams {
	interval?: '1h' | '1d' | '1w' | '1m';
	aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'p95' | 'p99';
	group_by?: 'service' | 'endpoint';
}

/**
 * Unified Query Parameters
 */
export interface IUnifiedMetricsParams {
	time_start?: number;
	time_end?: number;
	source?: 'auto' | 'cache' | 'db';
	metrics?: string;
	services?: string;
	phase?: 1 | 2;
	cursor?: string;
	limit?: number;
	format?: 'json' | 'csv';
}

/**
 * Historical Query Parameters (database-only)
 */
export interface IHistoricalMetricsParams {
	time_start: number;
	time_end: number;
	metrics?: string;
	services?: string;
	cursor?: string;
	limit?: number;
}

//---------------------------------------------------------
// Backup Management API Types
//---------------------------------------------------------

/**
 * Create Backup Request
 */
export interface ICreateBackupRequest {
	type?: 'full' | 'incremental' | 'selective';
}

/**
 * Backup Item
 */
export interface IBackupItem {
	id: string;
	path: string;
	size: number;
	created_at: number;
	type: string;
	status: string;
}

/**
 * Backup Response
 */
export interface IBackupResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IBackupItem;
}

/**
 * Backup List Response
 */
export interface IBackupListResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IBackupItem[];
	count: number;
}

/**
 * Restore Backup Request
 */
export interface IRestoreBackupRequest {
	backup_path: string;
}

/**
 * Restore Response
 */
export interface IRestoreResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data?: any;
}

/**
 * Backup Stats Response
 */
export interface IBackupStatsResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: {
		total_backups: number;
		success_rate: number;
		storage_usage: number;
		recent_activity: any[];
	};
}

//---------------------------------------------------------
// Compression Management API Types
//---------------------------------------------------------

/**
 * Run Compression Request
 */
export interface IRunCompressionRequest {
	force?: boolean;
}

/**
 * Compression Response
 */
export interface ICompressionResponse {
	success: boolean;
	message: string;
	timestamp: number;
	stats: {
		compressed_data: number;
		space_saved: number;
		compression_ratio: number;
		operation_time: number;
	};
}

/**
 * Compression Stats Response
 */
export interface ICompressionStatsResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: {
		compression_ratios: Record<string, number>;
		space_saved: number;
		operation_history: any[];
		performance_metrics: any;
	};
}

/**
 * Compression Candidates Response
 */
export interface ICompressionCandidatesResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: {
		candidates: any[];
		potential_savings: number;
		recommendations: any[];
	};
}

/**
 * Compression Estimate Response
 */
export interface ICompressionEstimateResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: {
		estimated_savings: number;
		compression_ratio: number;
		processing_time: number;
	};
}

//---------------------------------------------------------
// Alert Management API Types
//---------------------------------------------------------

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
	name: string;
	metric_name: string;
	condition: string;
	threshold: number;
	duration: number;
	severity: string;
	message: string;
	enabled: boolean;
	created_at: number;
	updated_at: number;
}

/**
 * Alert Rule Response
 */
export interface IAlertRuleResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IAlertRule;
}

/**
 * Alert Rules List Response
 */
export interface IAlertRulesListResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IAlertRule[];
}

/**
 * Alert
 */
export interface IAlert {
	id: string;
	rule_id: string;
	rule_name: string;
	metric_name: string;
	status: 'active' | 'resolved';
	severity: string;
	message: string;
	triggered_at: number;
	resolved_at?: number;
	resolved_by?: string;
	reason?: string;
}

/**
 * Active Alerts Response
 */
export interface IActiveAlertsResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IAlert[];
}

/**
 * All Alerts Response
 */
export interface IAllAlertsResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IAlert[];
}

/**
 * Alert Stats Response
 */
export interface IAlertStatsResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: {
		total_rules: number;
		active_alerts: number;
		alert_frequencies: Record<string, number>;
		system_performance: any;
	};
}

/**
 * Resolve Alert Request
 */
export interface IResolveAlertRequest {
	alert_ids?: string[];
	rule_name?: string;
	reason?: string;
	resolved_by: string;
}

/**
 * Resolve Alert Response
 */
export interface IResolveAlertResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: {
		resolved_count: number;
		resolved_alerts: string[];
	};
}

/**
 * Alert Response (single alert)
 */
export interface IAlertResponse {
	success: boolean;
	message: string;
	timestamp: number;
	data: IAlert;
}

/**
 * Delete Response
 */
export interface IDeleteResponse {
	success: boolean;
	message: string;
	timestamp: number;
}
