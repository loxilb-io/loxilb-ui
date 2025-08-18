//---------------------------------------------------------
// Advanced Metrics API Types
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
 * Pagination metadata
 */
export interface IPaginationMetadata {
	total: number;
	offset: number;
	limit: number;
	has_more: boolean;
	cursor?: string;
}

//---------------------------------------------------------
// Metric Classification by Priority
//---------------------------------------------------------

/**
 * Critical Metrics (20 metrics)
 * These are the most important metrics for system health and performance
 */
export type CriticalMetricName = 
	// Connection tracking metrics
	| 'active_conntrack_count'
	| 'active_flow_count_tcp'
	| 'active_flow_count_udp' 
	| 'active_flow_count_sctp'
	| 'inactive_flow_count'
	| 'new_flow_count'
	// Load balancer metrics
	| 'lb_rule_count'
	| 'lb_rules_per_service'
	| 'total_requests'
	| 'total_requests_per_service'
	| 'total_errors'
	| 'total_errors_per_service'
	// Health metrics
	| 'healthy_host_count'
	| 'unhealthy_host_count'
	| 'endpoint_health'
	| 'healthy_endpoints_count'
	| 'unhealthy_endpoints_count'
	// Firewall metrics
	| 'total_fw_drops'
	| 'total_fw_drops_per_rule'
	| 'firewall_rules_count';

/**
 * Important Metrics (22 metrics)
 * These provide detailed insights into system operation
 */
export type ImportantMetricName =
	// Processing metrics
	| 'processed_bytes_total'
	| 'processed_packets_total'
	| 'processed_tcp_bytes'
	| 'processed_udp_bytes'
	| 'processed_sctp_bytes'
	| 'processed_tcp_packets'
	| 'processed_udp_packets'
	| 'processed_sctp_packets'
	// RPS metrics
	| 'rps_1m_avg'
	| 'rps_1m_peak'
	| 'rps_bps'
	| 'rps_pps'
	| 'rps_eps'
	| 'rps_requests'
	| 'rps_time_window'
	| 'rps_trend_score'
	| 'rps_tcp_bps'
	| 'rps_udp_bps'
	| 'rps_sctp_bps'
	| 'rps_tcp_pps'
	| 'rps_udp_pps'
	| 'rps_sctp_pps'
	// LB RPS metrics
	| 'rps_lb_interaction_bps'
	| 'rps_lb_interaction_pps';

/**
 * Historical Metrics (7 metrics)
 * These provide long-term trends and distribution analysis
 */
export type HistoricalMetricName =
	// LB interaction metrics
	| 'lb_rule_interaction_bytes'
	| 'lb_rule_interaction_packets'
	// Distribution metrics
	| 'service_traffic_bytes'
	| 'endpoint_traffic_bytes'
	| 'service_distribution_ratio'
	| 'total_load_dists_per_service'
	| 'endpoint_load_dists_per_service';

/**
 * All Advanced Metrics
 */
export type AdvancedMetricName = CriticalMetricName | ImportantMetricName | HistoricalMetricName;

/**
 * Metric Priority Level
 */
export type MetricPriority = 'critical' | 'important' | 'historical';

/**
 * Metric Category for grouping
 */
export type MetricCategory = 
	| 'connection_tracking'
	| 'load_balancer'
	| 'health'
	| 'firewall'
	| 'processing'
	| 'rps'
	| 'distribution';

//---------------------------------------------------------
// Advanced Metrics Query Parameters
//---------------------------------------------------------

/**
 * Advanced Metrics Query Parameters
 */
export interface IAdvancedMetricsQueryParams {
	// Metric selection
	metrics?: string; // Comma-separated list of metric names
	categories?: string; // Comma-separated list of categories
	priorities?: string; // Comma-separated list of priorities
	
	// Time range
	time_start?: number; // Unix timestamp
	time_end?: number; // Unix timestamp
	interval?: number; // Aggregation interval in seconds
	
	// Filtering
	services?: string; // Comma-separated list of service names
	labels?: string; // Label selector (key=value,key2=value2)
	
	// Pagination
	limit?: number;
	offset?: number;
	cursor?: string;
	
	// Output format
	format?: 'json' | 'csv' | 'prometheus';
}

//---------------------------------------------------------
// Base Metric Data Structures  
//---------------------------------------------------------

/**
 * Metric metadata
 */
export interface IMetricMetadata {
	name: string;
	priority: MetricPriority;
	category: MetricCategory;
	description: string;
	unit: string;
	type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

/**
 * Enhanced metric with metadata
 */
export interface IAdvancedMetric {
	metadata: IMetricMetadata;
	data_points: IMetricDataPoint[];
	current_value?: number;
	last_updated?: number;
}

//---------------------------------------------------------
// Frontend-specific Data Structures
//---------------------------------------------------------

/**
 * Time range selection options
 */
export interface ITimeRangeOption {
	label: string;
	value: string;
	duration_ms: number;
	default_interval?: number;
}

/**
 * Metric dashboard configuration
 */
export interface IMetricsDashboardConfig {
	time_range: ITimeRangeOption;
	selected_metrics: AdvancedMetricName[];
	selected_categories: MetricCategory[];
	selected_priorities: MetricPriority[];
	auto_refresh: boolean;
	refresh_interval_ms: number;
	chart_type: 'line' | 'area' | 'bar' | 'gauge';
}

/**
 * Processed metrics data for UI components
 */
export interface IProcessedMetricsData {
	critical_metrics: IAdvancedMetric[];
	important_metrics: IAdvancedMetric[];
	historical_metrics: IAdvancedMetric[];
	summary_stats: {
		total_metrics: number;
		healthy_count: number;
		warning_count: number;
		critical_count: number;
	};
	last_updated: number;
}

/**
 * Live Metrics Data
 */
export interface ILiveMetricsData {
	timestamp: number;
	critical: Record<string, any>;
	important?: Record<string, any>;
	total_metrics: number;
	cache_enabled: boolean;
	phase: number;
}

/**
 * Live Metrics Response
 */
export interface ILiveMetricsResponse extends ILoxiLBAPIResponse {
	data: ILiveMetricsData;
}

/**
 * Cache Stats Response
 */
export interface ICacheStatsResponse extends ILoxiLBAPIResponse {
	data: {
		cache_enabled: boolean;
		total_entries: number;
		memory_usage_bytes: number;
		memory_usage_formatted: string;
		hit_rate_percentage: number;
		miss_rate_percentage: number;
		cache_age_seconds: number;
		performance_metrics: {
			avg_read_time_ms: number;
			avg_write_time_ms: number;
			operations_per_second: number;
		};
		eviction_stats: {
			total_evictions: number;
			eviction_policy: string;
			last_eviction: number;
		};
	};
}

/**
 * Metric Data Point
 */
export interface IMetricDataPoint {
	timestamp: number;
	metric_name: string;
	value: number;
	labels?: Record<string, string>;
	service_name?: string;
	endpoint?: string;
}

/**
 * Metric History Response
 */
export interface IMetricHistoryResponse extends ILoxiLBAPIResponse {
	data: IMetricDataPoint[];
	metric_name: string;
	time_range: {
		start_time: number;
		end_time: number;
		interval_seconds: number;
	};
	aggregation: {
		function: string;
		sample_count: number;
	};
}

/**
 * Metric Value Response
 */
export interface IMetricValueResponse extends ILoxiLBAPIResponse {
	data: IMetricDataPoint;
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
export interface IMetricsAggregateParams {
	time_start: number;
	time_end: number;
	metrics?: string;
	interval?: number;
	function?: 'avg' | 'sum' | 'min' | 'max' | 'count';
	group_by?: 'service' | 'endpoint';
}

/**
 * Unified Metrics Query Parameters
 */
export interface IUnifiedMetricsParams {
	time_start?: number;
	time_end?: number;
	metrics?: string;
	source?: 'cache' | 'database' | 'auto';
}

/**
 * Historical Metrics Query Parameters
 */
export interface IHistoricalMetricsParams {
	time_start: number;
	time_end: number;
	metrics?: string;
}

/**
 * Query Response
 */
export interface IQueryResponse extends ILoxiLBAPIResponse {
	data: IMetricDataPoint[];
	cursor?: string;
	has_more?: boolean;
	query_info: {
		total_records: number;
		execution_time_ms: number;
		data_source: 'cache' | 'database';
	};
}

/**
 * Query Request Item for batch operations
 */
export interface IQueryRequestItem {
	time_start: number;
	time_end: number;
	metrics?: string[];
	services?: string[];
	cursor?: string;
	limit?: number;
	format?: 'json' | 'csv';
}

/**
 * Batch Query Request
 */
export interface IBatchQueryRequest {
	queries: IQueryRequestItem[];
}

/**
 * Batch Query Response
 */
export interface IBatchQueryResponse extends ILoxiLBAPIResponse {
	data: Array<{
		query_index: number;
		result: IMetricDataPoint[];
		error?: string;
		execution_time_ms: number;
	}>;
	summary: {
		total_queries: number;
		successful_queries: number;
		failed_queries: number;
		total_execution_time_ms: number;
	};
}

/**
 * Aggregated Metrics Response
 */
export interface IAggregatedMetricsResponse extends ILoxiLBAPIResponse {
	data: Array<{
		timestamp: number;
		metric_name: string;
		value: number;
		aggregation_function: string;
		group_by?: string;
		service?: string;
		endpoint?: string;
		sample_count: number;
	}>;
	aggregation_info: {
		function: string;
		interval_seconds: number;
		group_by?: string;
		time_range: {
			start_time: number;
			end_time: number;
		};
	};
}

/**
 * Unified Query Response
 */
export interface IUnifiedQueryResponse extends ILoxiLBAPIResponse {
	data: IMetricDataPoint[];
	source: 'cache' | 'database';
	query_time_ms: number;
	routing_decision: {
		reason: string;
		data_freshness: 'live' | 'recent' | 'historical';
	};
}

/**
 * Historical Metrics Response
 */
export interface IHistoricalMetricsResponse extends ILoxiLBAPIResponse {
	data: IMetricDataPoint[];
	time_range: {
		start_time: number;
		end_time: number;
	};
	total_records: number;
}

/**
 * Advanced Live Metrics Response
 */
export interface IAdvancedLiveMetricsResponse extends ILoxiLBAPIResponse {
	data: ILiveMetricsData;
}

/**
 * Metrics Health Response
 */
export interface IMetricsHealthResponse extends ILoxiLBAPIResponse {
	data: {
		cache_status: 'healthy' | 'degraded' | 'unhealthy';
		database_status: 'healthy' | 'degraded' | 'unhealthy';
		api_status: 'healthy' | 'degraded' | 'unhealthy';
		overall_status: 'healthy' | 'degraded' | 'unhealthy';
		uptime_seconds: number;
		last_updated: number;
		component_details: {
			cache: {
				connectivity: boolean;
				response_time_ms: number;
				memory_usage_percentage: number;
			};
			database: {
				connectivity: boolean;
				response_time_ms: number;
				connection_pool_status: string;
			};
			api: {
				request_rate: number;
				error_rate_percentage: number;
				avg_response_time_ms: number;
			};
		};
		performance_metrics: {
			requests_per_second: number;
			cache_hit_rate: number;
			database_query_time_avg_ms: number;
			memory_usage_mb: number;
			cpu_usage_percentage: number;
		};
	};
}
