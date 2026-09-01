import {OpResult} from 'connector/fetcher/opResult';

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
// Live Metrics Snapshot (parsed from /metrics Prometheus exposition)
//---------------------------------------------------------
export interface ILiveMetricsResponse {
	timestamp: number;
	critical: Record<string, number>;
	important?: Record<string, number>;
	total_metrics: number;
	/**
	 * Whether the instance actually served an exposition for this snapshot.
	 *
	 * `false` means "we do not know any of these numbers" — collection is
	 * disabled, or the scrape was refused. It does NOT mean "the numbers are
	 * zero", and consumers must not render it as such. Distinguishing the two
	 * is the whole point of the field: without it, a disabled instance and a
	 * genuinely idle one produce byte-identical empty snapshots.
	 *
	 * Do not re-derive this as `total_metrics === 0`. The two happen to agree
	 * today, but they answer different questions, and a build that publishes an
	 * exposition with no samples yet would make them diverge.
	 */
	available: boolean;
	/**
	 * Why the scrape produced nothing, when it produced nothing (UI-P6-5).
	 *
	 * `available: false` says we do not know the numbers; this says whether
	 * that is a *state* or a *failure*, which is the difference between a
	 * placeholder and an error banner. Absent on a healthy scrape, and also
	 * absent when the instance answered 200 with an exposition that parses to
	 * no samples — that is a working instance reporting nothing, not a fault.
	 *
	 * `denied` here is the --userservice 401, `unavailable` is collection
	 * switched off (503), `failed` is an instance that is actually broken.
	 */
	failure?: OpResult;
}

/**
 * Strongly typed Live Metrics snapshot with known metric names.
 *
 * Keys are the **canonical** post-rename gateway metric names (`loxilb_*`); the
 * connector's `normalize_metric_names` shim populates them from the legacy names
 * on a pre-rename gateway, so this type is correct against both. Deleted
 * fabricated metrics (the old `rps_*` rate gauges, `inactive_flow_count`,
 * per-service request/error rollups) are intentionally gone — rate panels are
 * computed client-side from the cumulative counters below. See
 * `connector/instance/metrics.ts` and the gateway's METRICS-MIGRATION-UI.md.
 */
export interface ITypedLiveMetricsResponse {
	timestamp: number;
	critical: {
		// Connection tracking
		loxilb_active_conntrack_entries?: number;
		loxilb_active_flow_count_tcp?: number;
		loxilb_active_flow_count_udp?: number;
		loxilb_active_flow_count_sctp?: number;
		loxilb_new_flows?: number;
		loxilb_conntrack_max_entries?: number; // added on rename; absent pre-rename (→ util view hidden)

		// Load balancer
		loxilb_lb_rules?: number;

		// Endpoint health
		loxilb_healthy_endpoints?: number;
		loxilb_unhealthy_endpoints?: number;

		// System utilization (percent)
		loxilb_system_cpu_utilization_percent?: number;
		loxilb_system_memory_utilization_percent?: number;
		loxilb_system_disk_utilization_percent?: number;
	};
	important?: {
		// Cumulative traffic/error counters — the rate cards derive per-second
		// deltas from these (the old pre-computed rps_* gauges were deleted).
		loxilb_processed_bytes_total?: number;
		loxilb_processed_packets_total?: number;
		loxilb_errors_total?: number;
	};
	total_metrics: number;
	/** See `ILiveMetricsResponse.available`. */
	available: boolean;
	/** See `ILiveMetricsResponse.failure`. */
	failure?: OpResult;
}
