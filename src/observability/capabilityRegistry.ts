//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import capabilityMap from '../api/gen/loxilb-capability-map.json';
import {InstanceFlavor} from '../api/capabilities';
import {isGatewayScrapeFamily} from './metricManifest';

//---------------------------------------------------------
// Observability capability registry (UI-MON-001, UI-MON-011a)
//---------------------------------------------------------
// Deny-by-default registry of every observability page and dashboard panel.
// An entry is applicable only when EVERY requirement it declares is proven by
// a vendored contract artifact:
//   - metric families  → the vendored gateway metric manifest
//                        (class "default" + packaged + known runtime type)
//   - REST paths       → the generated capability map (a path the map marks
//                        gateway-only does not exist on plain loxilb)
//   - flavor           → resolved instance flavor; callers must pass the
//                        fail-narrow effective flavor (unresolved ⇒ 'loxilb'),
//                        never a broad fallback
//   - topology         → an explicit topology input; none exists today, so
//                        every topology-conditioned entry evaluates unknown
//                        and unknown is NON-APPLICABLE
// Anything the registry does not know — an unlisted entry id, an unlisted
// metric family, an undefined flavor — answers false.

export type ObservabilityEntryId =
	// Dashboard panels
	| 'dashboard.commonCards'
	| 'dashboard.gwAiEvents'
	| 'dashboard.gwActiveStreams'
	| 'dashboard.gwWorkerFreshness'
	| 'dashboard.gwKvExactNonReady'
	| 'dashboard.gwPersistenceFailures'
	// Observability pages
	| 'page.aiTraffic'
	| 'page.workers'
	| 'page.pdKv'
	| 'page.security'
	| 'page.qos'
	| 'page.persistence'
	| 'page.haSync';

export interface ITopologyInput {
	gatewayCount: number;
}

export interface IObservabilityEntry {
	id: ObservabilityEntryId;
	kind: 'page' | 'panel';
	// 'common' renders on both flavors; 'inference-gateway' only there.
	flavor: 'common' | 'inference-gateway';
	// Every family must be on the gateway scrape per the vendored manifest.
	metricFamilies: readonly string[];
	// Every path must exist on the instance's flavor per the capability map.
	restPaths: readonly string[];
	// When set, the entry additionally needs an explicit topology input
	// meeting the minimum. No delivery contract exists today (product
	// handoff), so these entries stay hidden.
	topology?: {minGatewayCount: number};
}

//---------------------------------------------------------
// Family sets (exact manifest names, grouped per the per-page matrix)
//---------------------------------------------------------

const AI_EVENT_FAMILIES = [
	// Completed SSE streams and point-of-denial counters. These are SEPARATE
	// event views: loxilb_ai_requests_total counts completed SSE streams
	// only, denials are counted at the point of denial, and non-streaming
	// successes are counted nowhere — no combination yields total request
	// rate or a true error ratio (BLOCKED on a gateway denominator contract).
	'loxilb_ai_requests_total',
	'loxilb_ai_rate_limit_hits_total',
	'loxilb_ai_model_not_allowed_total',
	'loxilb_ai_token_quota_denied_total',
] as const;

const AI_TRAFFIC_FAMILIES = [
	...AI_EVENT_FAMILIES,
	'loxilb_ai_request_duration_seconds',
	'loxilb_ai_active_streams',
	'loxilb_ai_tokens_consumed_total',
	'loxilb_ai_tokens_estimated_total',
	'loxilb_ai_tokens_missing_total',
	'loxilb_ai_token_quota_cold_open_total',
	'loxilb_ai_token_quota_utilization',
	'loxilb_ai_token_quota_limit_tokens',
	'loxilb_ai_token_quota_model_utilization',
	'loxilb_ai_token_quota_model_limit_tokens',
	'loxilb_ai_normal_session_hits_total',
	'loxilb_ai_engine_info',
] as const;

// P/D & KV page. NOT here despite the prefix: the 8 loxilb_pd_ctrl_*
// families are class "aictrl-bridge", packaged false — they live on the
// standalone AI controller's scrape, not the gateway's. Likewise the
// loxilb_kv_fetch_*/loxilb_kv_evictions_*/loxilb_kv_bytes_* families belong
// to the standalone KV agent and loxilb_kv_agent_up to its health probe.
const PD_KV_FAMILIES = [
	// sockproxy P/D data path
	'loxilb_pd_admission_queued_total',
	'loxilb_pd_admission_shed_total',
	'loxilb_pd_cb_flips_total',
	'loxilb_pd_cb_proactive_heal_total',
	'loxilb_pd_connect_failover_total',
	'loxilb_pd_connect_retry_same_ep_ok_total',
	'loxilb_pd_connect_retry_same_ep_total',
	'loxilb_pd_decode_ep_died_total',
	'loxilb_pd_decode_zero_byte_eof_total',
	'loxilb_pd_ep_info',
	'loxilb_pd_fallback_to_normal_total',
	'loxilb_pd_kv_blocks',
	'loxilb_pd_kv_tier15_cold_seeds_total',
	'loxilb_pd_kv_tier15_fallthrough_total',
	'loxilb_pd_kv_tier15_hits_total',
	'loxilb_pd_kv_tier15_miss_reason_total',
	'loxilb_pd_kv_tier15_spills_total',
	'loxilb_pd_kv_zero_hit_watchdog_total',
	'loxilb_pd_prefill_ep_died_total',
	'loxilb_pd_sessions_active',
	'loxilb_pd_sg_decode_close_drain_total',
	'loxilb_pd_sg_oversize_reject_total',
	'loxilb_pd_sg_prefill_abort_decode_total',
	'loxilb_pd_sg_prefill_reject_relay_total',
	'loxilb_pd_sg_room_retry_total',
	'loxilb_pd_trie_nodes',
	'loxilb_pd_trt_ctx_early_exit_total',
	'loxilb_proxy_pd_kv_params_overflow_total',
	// AI-side P/D
	'loxilb_ai_pd_prefill_duration_seconds',
	'loxilb_ai_pd_decode_ttft_seconds',
	'loxilb_ai_pd_requests_total',
	'loxilb_ai_pd_session_hits_total',
	'loxilb_ai_pd_kv_params_found_total',
	'loxilb_ai_pd_kv_params_missing_total',
	// KV attestation / TRT-LLM drain
	'loxilb_ai_kv_attest_state',
	'loxilb_ai_kv_attest_echo_total',
	'loxilb_ai_kv_attest_probe_fail_total',
	'loxilb_ai_kv_enforcement_fault',
	'loxilb_ai_kv_trtllm_drain_ownership_fault_total',
	'loxilb_ai_kv_trtllm_drain_ownership_heal_total',
	// KV subscriber / inventory (gateway-side)
	'loxilb_kv_subscriber_connected',
	'loxilb_kv_subscriber_last_event_timestamp_seconds',
	'loxilb_kv_subscriber_reconnect_total',
	'loxilb_kv_subscriber_recv_error_total',
	'loxilb_kv_subscriber_wire_reject_total',
	'loxilb_kv_inventory_fresh',
	'loxilb_kv_inv_cap_evictions_total',
] as const;

// Security page: real family groups — there is no securityrate-prefixed
// family and no llamafirewall_*/pii_* family.
const SECURITY_FAMILIES = [
	// core security counters
	'loxilb_security_syn_blocked_total',
	'loxilb_security_syn_passed_total',
	'loxilb_security_syn_cookies_total',
	'loxilb_security_conn_blocked_total',
	'loxilb_security_conn_passed_total',
	'loxilb_security_udp_blocked_total',
	'loxilb_security_udp_passed_total',
	'loxilb_security_udp_bytes_blocked_total',
	'loxilb_security_udp_bytes_passed_total',
	'loxilb_security_unique_ips',
	// firewall
	'loxilb_fw_drop_packets_total',
	'loxilb_fw_rule_drop_packets_total',
	'loxilb_firewall_rules',
	// IP filter
	'loxilb_ipfilter_blacklist_packets_total',
	'loxilb_ipfilter_blacklist_bytes_total',
	'loxilb_ipfilter_whitelist_packets_total',
	'loxilb_ipfilter_whitelist_bytes_total',
	'loxilb_ipfilter_rules',
	// L4
	'loxilb_l4_error_events_total',
	// OPA
	'loxilb_opa_watcher_syncs_total',
	'loxilb_opa_sync_duration_seconds',
	'loxilb_opa_firewall_rules',
	'loxilb_opa_circuit_breaker_state',
	// AI security
	'loxilb_ai_model_not_allowed_total',
	'loxilb_ai_rate_limit_hits_total',
	'loxilb_ai_unmetered_requests_total',
	'loxilb_ai_policy_store_unavailable_total',
] as const;

const QOS_FAMILIES = [
	'loxilb_proxy_qos_bytes_passed_total',
	'loxilb_proxy_qos_bytes_delayed_total',
	'loxilb_proxy_qos_parks_total',
	'loxilb_proxy_qos_park_seconds_total',
	'loxilb_proxy_qos_parked_connections',
	'loxilb_proxy_qos_tokens_bytes',
	'loxilb_proxy_qos_cbs_bytes',
	'loxilb_proxy_qos_cir_bytes_per_second',
] as const;

const PERSISTENCE_FAMILIES = [
	'loxilb_snapshot_total',
	'loxilb_restore_total',
	'loxilb_restore_duration_seconds',
	'loxilb_last_restore_timestamp_seconds',
	'loxilb_persist_total',
	'loxilb_autopersist_consecutive_failures',
	'loxilb_config_dirty',
	'loxilb_snapshot_quarantine_total',
	'loxilb_boot_config_conflict_total',
	'loxilb_boot_legacy_fallback_total',
] as const;

const HA_SYNC_FAMILIES = [
	'loxilb_sockproxy_sync_overflow_total',
	'loxilb_sockproxy_sync_health_reject_total',
	'loxilb_sockproxy_sync_apply_errors_total',
	'loxilb_sockproxy_sync_conflict_total',
	'loxilb_sockproxy_sync_push_latency_seconds',
	'loxilb_sockproxy_sync_inflight_rpc',
	'loxilb_sockproxy_sync_drop_total',
	'loxilb_sockproxy_sync_peer_up',
	'loxilb_sockproxy_sync_peer_lag_seconds',
	'loxilb_proxy_conversation_sessions',
	'loxilb_proxy_conversation_hits_total',
	'loxilb_proxy_conversation_misses_total',
	'loxilb_proxy_conversation_ttl_expired_total',
] as const;

//---------------------------------------------------------
// Registry
//---------------------------------------------------------

const entries: readonly IObservabilityEntry[] = [
	{
		// Existing common dashboard cards; served through the UI-MON-006
		// compatibility adapter. No gateway-only requirement.
		id: 'dashboard.commonCards',
		kind: 'panel', flavor: 'common',
		metricFamilies: [], restPaths: [],
	},
	{
		id: 'dashboard.gwAiEvents',
		kind: 'panel', flavor: 'inference-gateway',
		metricFamilies: AI_EVENT_FAMILIES, restPaths: [],
	},
	{
		id: 'dashboard.gwActiveStreams',
		kind: 'panel', flavor: 'inference-gateway',
		metricFamilies: ['loxilb_ai_active_streams'], restPaths: [],
	},
	{
		// REST-fed (C-1): worker/GPU telemetry has no Prometheus families.
		id: 'dashboard.gwWorkerFreshness',
		kind: 'panel', flavor: 'inference-gateway',
		metricFamilies: [], restPaths: ['/config/gpu/status'],
	},
	{
		id: 'dashboard.gwKvExactNonReady',
		kind: 'panel', flavor: 'inference-gateway',
		metricFamilies: ['loxilb_ai_kv_attest_state', 'loxilb_ai_kv_enforcement_fault'], restPaths: [],
	},
	{
		// Last-persist timestamp exists only on /diagnostics, not as a metric.
		id: 'dashboard.gwPersistenceFailures',
		kind: 'panel', flavor: 'inference-gateway',
		metricFamilies: ['loxilb_config_dirty', 'loxilb_autopersist_consecutive_failures', 'loxilb_persist_total'],
		restPaths: ['/diagnostics'],
	},
	{
		id: 'page.aiTraffic',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: AI_TRAFFIC_FAMILIES, restPaths: [],
	},
	{
		// REST-first page (C-1); the metric families are adjacency only.
		id: 'page.workers',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: ['loxilb_pd_kv_blocks', 'loxilb_pd_admission_queued_total', 'loxilb_pd_admission_shed_total'],
		restPaths: ['/config/worker/metrics', '/config/gpu/status'],
	},
	{
		id: 'page.pdKv',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: PD_KV_FAMILIES, restPaths: [],
	},
	{
		id: 'page.security',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: SECURITY_FAMILIES, restPaths: [],
	},
	{
		id: 'page.qos',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: QOS_FAMILIES, restPaths: [],
	},
	{
		id: 'page.persistence',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: PERSISTENCE_FAMILIES, restPaths: ['/diagnostics'],
	},
	{
		// Topology-conditioned: the evidenced ProductLock tuple is
		// single-Gateway, and no ProductLock→UI delivery contract exists yet
		// (product handoff), so this stays hidden until an explicit topology
		// input proves gatewayCount > 1.
		id: 'page.haSync',
		kind: 'page', flavor: 'inference-gateway',
		metricFamilies: HA_SYNC_FAMILIES, restPaths: [],
		topology: {minGatewayCount: 2},
	},
];

const byId: ReadonlyMap<string, IObservabilityEntry> = new Map(entries.map(e => [e.id, e]));

export function getObservabilityEntry(id: ObservabilityEntryId): IObservabilityEntry | undefined {
	return byId.get(id);
}

export function allObservabilityEntries(): readonly IObservabilityEntry[] {
	return entries;
}

const gatewayOnlyPaths: string[] = capabilityMap.gatewayOnlyPaths;

// Whether a REST path exists on the flavor, by the same prefix mechanics as
// hasFeature. Gateway-only paths are absent on plain loxilb.
function restPathAvailable(flavor: InstanceFlavor, path: string): boolean {
	if (flavor === 'inference-gateway') return true;
	return !gatewayOnlyPaths.some(p => p === path || p.startsWith(`${path}/`));
}

// Deny-by-default applicability. `flavor` must be the resolved (or
// fail-narrow effective) instance flavor: pass undefined only when no
// instance is selected at all — everything is denied then. `topology` is the
// explicit topology input; omit it while no delivery contract exists and
// topology-conditioned entries answer false (unknown ⇒ non-applicable).
export function isEntryApplicable(
	id: ObservabilityEntryId,
	flavor: InstanceFlavor | undefined,
	topology?: ITopologyInput,
): boolean {
	const entry = byId.get(id);
	if (!entry || flavor === undefined) return false;
	if (entry.flavor === 'inference-gateway' && flavor !== 'inference-gateway') return false;
	if (!entry.metricFamilies.every(isGatewayScrapeFamily)) return false;
	if (!entry.restPaths.every(p => restPathAvailable(flavor, p))) return false;
	if (entry.topology && (topology === undefined || topology.gatewayCount < entry.topology.minGatewayCount)) return false;
	return true;
}

// The applicable entry set for a flavor — what the dashboard composer and
// the layout key-set reconciliation (UI-MON-006) key off.
export function applicableEntries(
	flavor: InstanceFlavor | undefined,
	topology?: ITopologyInput,
): ObservabilityEntryId[] {
	return entries.filter(e => isEntryApplicable(e.id, flavor, topology)).map(e => e.id);
}
