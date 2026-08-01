//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ILiveMetricsResponse} from 'types/metrics';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Live Metrics via Prometheus exposition (gateway: /netlox/v1/metrics)
//---------------------------------------------------------

// Parses Prometheus text format into a flat {metric_name: value} map.
// Labeled samples of the same metric are summed, which matches how the
// dashboard cards consume a flat metric snapshot.
export function parse_prometheus_text(text: string): Record<string, number> {
	const values: Record<string, number> = {};
	for (const line of text.split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+]+)/);
		if (!match) continue;
		const value = Number(match[3]);
		if (!Number.isFinite(value)) continue;
		values[match[1]] = (values[match[1]] ?? 0) + value;
	}
	return values;
}

//---------------------------------------------------------
// Metric-name migration shim (canonical = post-`loxilb_` names)
//---------------------------------------------------------
// The gateway's Prometheus surface was renamed ahead of public release: every
// metric now carries the `loxilb_` namespace, unit suffixes were fixed, and a
// handful of fabricated metrics were deleted (see the gateway team's
// METRICS-MIGRATION-UI.md). The UI reads the raw scrape, so the dashboard cards
// would break the day the gateway ships the rename.
//
// To decouple the UI from the rollout, the cards read a stable **canonical**
// key set (the new `loxilb_*` names). `normalize_metric_names` resolves each
// canonical key new-name-first and falls back to the legacy name, so the same
// build works against both a pre-rename gateway (current testbed) and a
// post-rename one — no flag-day coupling between UI and gateway deploys.
//
// `canonicalName: legacyName`
const METRIC_ALIASES: Record<string, string> = {
	// Connection tracking
	loxilb_active_conntrack_entries: 'active_conntrack_count',
	loxilb_active_flow_count_tcp: 'active_flow_count_tcp',
	loxilb_active_flow_count_udp: 'active_flow_count_udp',
	loxilb_active_flow_count_sctp: 'active_flow_count_sctp',
	loxilb_new_flows: 'new_flow_count',
	// Load balancer
	loxilb_lb_rules: 'lb_rule_count',
	// Endpoint health
	loxilb_healthy_endpoints: 'healthy_endpoints_count',
	loxilb_unhealthy_endpoints: 'unhealthy_endpoints_count',
	// System utilization (unit suffix added on rename)
	loxilb_system_cpu_utilization_percent: 'system_cpu_utilization',
	loxilb_system_memory_utilization_percent: 'system_memory_utilization',
	loxilb_system_disk_utilization_percent: 'system_disk_utilization',
	// Cumulative traffic/error counters (drive the client-side rate cards, since
	// the old pre-computed rps_* rate gauges were deleted as fabricated).
	loxilb_processed_bytes_total: 'processed_bytes_total',
	loxilb_processed_packets_total: 'processed_packets_total',
	loxilb_errors_total: 'total_errors',
};

// Populate each canonical key from its legacy name when the canonical one is
// absent (pre-rename gateway). Mutates and returns the same map. Metrics with
// no legacy equivalent (e.g. loxilb_conntrack_max_entries, added on rename) are
// simply absent against an old gateway — the cards treat absence as N/A.
export function normalize_metric_names(metrics: Record<string, number>): Record<string, number> {
	for (const [canonical, legacy] of Object.entries(METRIC_ALIASES)) {
		if (metrics[canonical] === undefined && metrics[legacy] !== undefined) {
			metrics[canonical] = metrics[legacy];
		}
	}
	return metrics;
}

/**
 * Get a real-time snapshot of all gateway metrics.
 * The gateway exposes its metric registry in Prometheus text format. Names are
 * normalized to the canonical `loxilb_*` surface (with legacy fallback) so the
 * dashboard cards read a stable key set across the metric rename.
 *
 * When Prometheus collection is disabled the gateway returns HTTP 503 (enable
 * via `POST /netlox/v1/config/metrics`); we surface that as an empty snapshot so
 * the cards render zeros/placeholders rather than erroring.
 */
export async function query_get_live_metrics(instance: IInstance, _phase: 1 | 2 = 2): Promise<ILiveMetricsResponse> {
	const resp = await GET_INST_TEXT(instance, `/metrics`);
	// 503 = collection disabled; any non-200 (401 on --userservice, etc.) is not
	// a valid exposition — treat as an empty snapshot.
	const metrics = resp.code === 200 && typeof resp.data === 'string' ? normalize_metric_names(parse_prometheus_text(resp.data)) : {};
	return {
		timestamp: Date.now(),
		critical: metrics,
		important: metrics,
		total_metrics: Object.keys(metrics).length,
	};
}
