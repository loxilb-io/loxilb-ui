/**
 * Metrics Constants - Synchronized with Go implementation
 * This ensures type safety and consistency across the application
 */

//---------------------------------------------------------
// Critical Metrics (Phase 1)
//---------------------------------------------------------
export const CRITICAL_METRICS = {
  // Connection tracking metrics
  ACTIVE_CONNTRACK_COUNT: 'active_conntrack_count',
  ACTIVE_FLOW_COUNT_TCP: 'active_flow_count_tcp',
  ACTIVE_FLOW_COUNT_UDP: 'active_flow_count_udp',
  ACTIVE_FLOW_COUNT_SCTP: 'active_flow_count_sctp',
  INACTIVE_FLOW_COUNT: 'inactive_flow_count',
  NEW_FLOW_COUNT: 'new_flow_count',

  // Load balancer metrics
  LB_RULE_COUNT: 'lb_rule_count',
  LB_RULES_PER_SERVICE: 'lb_rules_per_service',
  TOTAL_REQUESTS: 'total_requests',
  TOTAL_REQUESTS_PER_SERVICE: 'total_requests_per_service',
  TOTAL_ERRORS: 'total_errors',
  TOTAL_ERRORS_PER_SERVICE: 'total_errors_per_service',

  // Endpoint health metrics
  HEALTHY_HOST_COUNT: 'healthy_host_count',
  UNHEALTHY_HOST_COUNT: 'unhealthy_host_count',
  ENDPOINT_HEALTH: 'endpoint_health',
  HEALTHY_ENDPOINTS_COUNT: 'healthy_endpoints_count',
  UNHEALTHY_ENDPOINTS_COUNT: 'unhealthy_endpoints_count',

  // Firewall metrics
  TOTAL_FW_DROPS: 'total_fw_drops',
  TOTAL_FW_DROPS_PER_RULE: 'total_fw_drops_per_rule',
  FIREWALL_RULES_COUNT: 'firewall_rules_count',
} as const;

//---------------------------------------------------------
// Important Metrics (Phase 2)
//---------------------------------------------------------
export const IMPORTANT_METRICS = {
  // Traffic processing metrics
  PROCESSED_BYTES_TOTAL: 'processed_bytes_total',
  PROCESSED_PACKETS_TOTAL: 'processed_packets_total',
  PROCESSED_TCP_BYTES: 'processed_tcp_bytes',
  PROCESSED_UDP_BYTES: 'processed_udp_bytes',
  PROCESSED_SCTP_BYTES: 'processed_sctp_bytes',
  PROCESSED_TCP_PACKETS: 'processed_tcp_packets',
  PROCESSED_UDP_PACKETS: 'processed_udp_packets',
  PROCESSED_SCTP_PACKETS: 'processed_sctp_packets',

  // RPS Calculator metrics
  REQUESTS_PER_SECOND_AVG_1M: 'rps_1m_avg',
  REQUESTS_PER_SECOND_PEAK_1M: 'rps_1m_peak',
  BYTES_PER_SECOND: 'rps_bps',
  PACKETS_PER_SECOND: 'rps_pps',
  ERRORS_PER_SECOND: 'rps_eps',
  REQUESTS_PER_SECOND: 'rps_requests',
  REQUESTS_PER_SECOND_WINDOW: 'rps_time_window',
  REQUESTS_PER_SECOND_TREND: 'rps_trend_score',
  TCP_BYTES_PER_SECOND: 'rps_tcp_bps',
  UDP_BYTES_PER_SECOND: 'rps_udp_bps',
  SCTP_BYTES_PER_SECOND: 'rps_sctp_bps',
  TCP_PACKETS_PER_SECOND: 'rps_tcp_pps',
  UDP_PACKETS_PER_SECOND: 'rps_udp_pps',
  SCTP_PACKETS_PER_SECOND: 'rps_sctp_pps',

  // LB interaction RPS metrics
  LB_INTERACTION_BYTES_PER_SECOND: 'rps_lb_interaction_bps',
  LB_INTERACTION_PACKETS_PER_SECOND: 'rps_lb_interaction_pps',
} as const;

//---------------------------------------------------------
// Historical Metrics
//---------------------------------------------------------
export const HISTORICAL_METRICS = {
  // Load balancer interaction metrics
  LB_RULE_INTERACTION_BYTES: 'lb_rule_interaction_bytes',
  LB_RULE_INTERACTION_PACKETS: 'lb_rule_interaction_packets',

  // Distribution metrics
  SERVICE_TRAFFIC_BYTES: 'service_traffic_bytes',
  ENDPOINT_TRAFFIC_BYTES: 'endpoint_traffic_bytes',
  SERVICE_DISTRIBUTION_RATIO: 'service_distribution_ratio',
  TOTAL_LOAD_DISTS_PER_SERVICE: 'total_load_dists_per_service',
  ENDPOINT_LOAD_DISTS_PER_SERVICE: 'endpoint_load_dists_per_service',

  // LCU metrics
  CONSUMED_LCUS: 'consumed_lcus',
  LCU_CAPACITY_TOTAL: 'lcu_capacity_units_total',
  LCU_UTILIZATION_RATIO: 'lcu_utilization_ratio',
  LCU_FLOW_COMPONENT: 'lcu_flow_component',
  LCU_RULE_COMPONENT: 'lcu_rule_component',
  LCU_BYTE_COMPONENT: 'lcu_byte_component',
  LCU_NEW_FLOWS: 'lcu_new_flows',
  LCU_ACTIVE_FLOWS: 'lcu_active_flows',
  LCU_RULE_COUNT: 'lcu_rule_count',
  LCU_PROCESSED_BYTES: 'lcu_processed_bytes',
} as const;

//---------------------------------------------------------
// Metric Categories
//---------------------------------------------------------
export const METRIC_CATEGORIES = {
  CRITICAL: Object.values(CRITICAL_METRICS),
  IMPORTANT: Object.values(IMPORTANT_METRICS),
  HISTORICAL: Object.values(HISTORICAL_METRICS),
} as const;

export type CriticalMetric = typeof CRITICAL_METRICS[keyof typeof CRITICAL_METRICS];
export type ImportantMetric = typeof IMPORTANT_METRICS[keyof typeof IMPORTANT_METRICS];
export type HistoricalMetric = typeof HISTORICAL_METRICS[keyof typeof HISTORICAL_METRICS];
export type AllMetrics = CriticalMetric | ImportantMetric | HistoricalMetric;

//---------------------------------------------------------
// Metric Phase Configuration
//---------------------------------------------------------
export const METRIC_PHASES = {
  1: METRIC_CATEGORIES.CRITICAL,
  2: [...METRIC_CATEGORIES.CRITICAL, ...METRIC_CATEGORIES.IMPORTANT],
} as const;

export type MetricPhase = keyof typeof METRIC_PHASES;
