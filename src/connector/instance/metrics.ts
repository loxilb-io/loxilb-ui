//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor} from 'api/capabilities';
import {ILiveMetricsResponse} from 'types/metrics';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Live Metrics via Prometheus exposition (gateway: /netlox/v1/metrics)
//---------------------------------------------------------

// Parses Prometheus text format into a flat {metric_name: value} map.
// Labeled samples of the same metric are summed, which matches how the
// dashboard cards consume a flat metric snapshot.
//
// The value pattern spells out the full Prometheus number grammar, including a
// SIGNED exponent. The previous `-?[0-9.eE+]+` had no `-` inside the exponent,
// so `7.9598e-05` captured as `7.9598e`, became NaN, and was dropped by the
// isFinite guard below — a sample silently vanishing rather than erroring.
// Observed live on a real scrape (`go_gc_duration_seconds`); no `loxilb_*`
// series uses a negative exponent today, but any small ratio would.
export function parse_prometheus_text(text: string): Record<string, number> {
	const values: Record<string, number> = {};
	for (const line of text.split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[+-]?Inf|NaN)/);
		if (!match) continue;
		const value = Number(match[3]);
		if (!Number.isFinite(value)) continue;
		values[match[1]] = (values[match[1]] ?? 0) + value;
	}
	return values;
}

//---------------------------------------------------------
// Metric-name normalization (canonical = post-`loxilb_` gateway names)
//---------------------------------------------------------
// The dashboard cards read one stable **canonical** key set. Each backend
// flavor publishes its own Prometheus naming, and the Prometheus surface is
// NOT part of the swagger contract — so nothing in the generated capability
// map or the subset contract test can police it. It is an unversioned
// side-contract, and the only defence is a per-flavor table plus fixtures.
//
// The tables are kept **separate per flavor** rather than merged into one
// list of candidate names. A merged list resolves first-match-wins across
// backends, which would silently cross-map a name that means different things
// on the two products (and would quietly start reading the wrong series the
// day either side adds a name the other already uses). Separate tables also
// let each flavor be asserted independently in tests.
//
// `canonicalName: backendName`

// loxilb-inference-gateway, pre-`loxilb_` rename. The gateway renamed its whole
// surface ahead of public release (namespace + unit suffixes, fabricated
// metrics deleted — see the gateway team's METRICS-MIGRATION-UI.md). Resolving
// canonical-first with these as fallback keeps one UI build working against
// both a pre-rename and a post-rename gateway — no flag-day deploy coupling.
const GATEWAY_ALIASES: Record<string, string> = {
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

// Upstream loxilb — a third, independent naming generation, verified live
// against v0.9.8-dev (`GET /netlox/v1/metrics`). It shares the conntrack/flow/
// lb-rule names with the pre-rename gateway but diverges on three fronts:
// endpoint health is counted per *host*, the cumulative counters carry no
// `_total` suffix, and system utilization is not exported at all.
//
// SINCE THE METRICS-PARITY BUILD, loxilb publishes every canonical name in this
// file natively, alongside its legacy names (dual-emit; the legacy families are
// tagged `DEPRECATED: use <canonical>` in their HELP text). Against such an
// instance this table is dead weight — resolution finds the canonical name
// first and never consults it.
//
// It stays anyway, and MUST stay until the fleet has upgraded. The UI connects
// to whatever instances an operator has registered, and a released loxilb-oss
// build publishes legacy names only. Deleting the table would blank every card
// on every un-upgraded instance the moment this UI ships — the same
// no-flag-day-coupling argument that keeps GATEWAY_ALIASES above.
//
// Sunset condition: drop an entry only once no supported loxilb-oss release
// publishes that legacy name. That is a fleet fact, not a code fact — check
// before deleting.
const LOXILB_ALIASES: Record<string, string> = {
	// Connection tracking — identical to the pre-rename gateway
	loxilb_active_conntrack_entries: 'active_conntrack_count',
	loxilb_active_flow_count_tcp: 'active_flow_count_tcp',
	loxilb_active_flow_count_udp: 'active_flow_count_udp',
	loxilb_active_flow_count_sctp: 'active_flow_count_sctp',
	loxilb_new_flows: 'new_flow_count',
	// Load balancer
	loxilb_lb_rules: 'lb_rule_count',
	// Endpoint health — upstream counts hosts, not endpoints
	loxilb_healthy_endpoints: 'healthy_host_count',
	loxilb_unhealthy_endpoints: 'unhealthy_host_count',
	// Cumulative traffic counters — upstream omits the `_total` suffix
	loxilb_processed_bytes_total: 'processed_bytes',
	loxilb_processed_packets_total: 'processed_packets',
	loxilb_errors_total: 'total_errors',
	// NOTE: `loxilb_system_*_utilization_percent` and `loxilb_conntrack_max_entries`
	// have no entry here, and never will — there is no legacy name to alias them
	// TO. A pre-parity loxilb does not export them in any spelling; a
	// parity-build loxilb exports them under the canonical name, which needs no
	// alias.
	//
	// So absence still carries meaning, and consumers must keep honouring it:
	// missing => the instance does not report this, render N/A. Never
	// substitute a zero — a 0%-used pie and a 0-capacity conntrack ratio are
	// both indistinguishable from a real reading, and the second divides by zero.
};

const ALIASES_BY_FLAVOR: Record<InstanceFlavor, Record<string, string>> = {
	'inference-gateway': GATEWAY_ALIASES,
	loxilb: LOXILB_ALIASES,
};

// Populate each canonical key from its flavor-specific backend name when the
// canonical one is absent. Mutates and returns the same map. A canonical metric
// the flavor does not publish stays **absent** — never zero — so cards can tell
// "not reported" apart from "reported as nothing happening".
export function normalize_metric_names(metrics: Record<string, number>, flavor: InstanceFlavor): Record<string, number> {
	for (const [canonical, backendName] of Object.entries(ALIASES_BY_FLAVOR[flavor])) {
		if (metrics[canonical] === undefined && metrics[backendName] !== undefined) {
			metrics[canonical] = metrics[backendName];
		}
	}
	return metrics;
}

/**
 * Get a real-time snapshot of an instance's metrics.
 * Both backends expose their metric registry in Prometheus text format. Names
 * are normalized to the canonical `loxilb_*` surface using the table for the
 * caller-supplied `flavor`, so the dashboard cards read a stable key set on
 * either product.
 *
 * `flavor` is required rather than defaulted: reading a scrape under the wrong
 * table yields silently wrong numbers, so the decision belongs to the caller
 * (see `useLiveMetrics`, which sources it from the /version probe).
 *
 * When Prometheus collection is disabled, BOTH flavors now return HTTP 503
 * (enable via `POST /netlox/v1/config/metrics`). Pre-parity loxilb-oss instead
 * answered 200 with the JSON string `"Prometheus option is disabled."`, which
 * is not a valid exposition — Prometheus itself rejects it with
 * `expected a valid start token, got "\""`. That body parses to `{}` here,
 * which is why it has been indistinguishable from a live all-zero instance.
 *
 * KNOWN GAP: this function still collapses "collection is off", "auth failed"
 * and "everything really is 0" into the same empty snapshot, because
 * ILiveMetricsResponse has no way to say "unknown". The 503 makes the
 * distinction *available*; representing it is the next change. See
 * docs/internal/METRICS_LOXILB_PARITY.md.
 */
export async function query_get_live_metrics(instance: IInstance, flavor: InstanceFlavor): Promise<ILiveMetricsResponse> {
	const resp = await GET_INST_TEXT(instance, `/metrics`);
	// 503 = collection disabled; any non-200 (401 on --userservice, etc.) is not
	// a valid exposition — treat as an empty snapshot.
	const metrics = resp.code === 200 && typeof resp.data === 'string' ? normalize_metric_names(parse_prometheus_text(resp.data), flavor) : {};
	return {
		timestamp: Date.now(),
		critical: metrics,
		important: metrics,
		total_metrics: Object.keys(metrics).length,
	};
}
