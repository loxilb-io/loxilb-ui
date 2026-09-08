//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import vendored from '../api/gen/metric-manifest.json';

//---------------------------------------------------------
// Vendored gateway metric manifest (UI-MON-001)
//---------------------------------------------------------
// The gateway's deploy/monitoring/manifest/metric-manifest.json is the only
// durable gateway-side metrics contract artifact (its METRICS.md is
// git-ignored and stale). It is vendored verbatim into api-spec/ and wrapped
// with a UI-owned version envelope by scripts/gen-metric-manifest.mjs because
// upstream ships no version/generated-at field.
//
// Two upstream quirks this module normalizes, never leaks:
// - `type: "desc"` marks HOW the generator found a family (a custom-collector
//   Desc), not a Prometheus runtime type. Runtime types for those families
//   are pinned in DESC_RUNTIME_TYPES; the extraction mechanism is kept in a
//   separate `definitionMechanism` field. `desc` must never enter the runtime
//   type union.
// - Applicability is class+packaged, not a flavor field: only
//   `class == "default" && packaged` families are on the gateway scrape.
//   Look-alikes (`loxilb_kv_fetch_*` on the standalone KV agent,
//   `loxilb_pd_ctrl_*` on the aictrl bridge) are real families of OTHER
//   scrape targets and must never be treated as gateway-applicable.

export type ManifestClass =
	| 'default'
	| 'dpu-doca'
	| 'aictrl-bridge'
	| 'kv-agent-health'
	| 'standalone-controller'
	| 'standalone-kv-agent';

// Prometheus runtime family types only. `unknown` is a deny sentinel: a
// family whose exposition/manifest type the UI cannot map keeps its raw
// token in `rawType` for diagnostics and can never satisfy a capability
// requirement.
export type RuntimeMetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'untyped' | 'unknown';

export type DefinitionMechanism = 'direct' | 'desc';

export interface IManifestFamily {
	name: string;
	owner: string;
	class: ManifestClass;
	packaged: boolean;
	runtimeType: RuntimeMetricType;
	// Present when runtimeType is 'unknown': the unrecognized upstream token.
	rawType?: string;
	definitionMechanism: DefinitionMechanism;
	labels: string[];
	activation: string;
	priority: string;
	privacy: string;
	waiver: string;
}

// Pinned runtime types for the custom-collector (`desc`) families: the
// generator cannot see past the Desc, but the collector sources fix them as
// 4 counters + 8 gauges + 1 histogram. A new upstream `desc` family that is
// not listed here surfaces as runtimeType 'unknown' (deny) until pinned.
const DESC_RUNTIME_TYPES: Record<string, RuntimeMetricType> = {
	// QoS shaper collector: 4 counters + 4 gauges
	loxilb_proxy_qos_bytes_delayed_total: 'counter',
	loxilb_proxy_qos_bytes_passed_total: 'counter',
	loxilb_proxy_qos_park_seconds_total: 'counter',
	loxilb_proxy_qos_parks_total: 'counter',
	loxilb_proxy_qos_cbs_bytes: 'gauge',
	loxilb_proxy_qos_cir_bytes_per_second: 'gauge',
	loxilb_proxy_qos_parked_connections: 'gauge',
	loxilb_proxy_qos_tokens_bytes: 'gauge',
	// AI token-quota collector: 4 gauges
	loxilb_ai_token_quota_utilization: 'gauge',
	loxilb_ai_token_quota_limit_tokens: 'gauge',
	loxilb_ai_token_quota_model_utilization: 'gauge',
	loxilb_ai_token_quota_model_limit_tokens: 'gauge',
	// TTFB ConstHistogram
	loxilb_proxy_http_ttfb_seconds: 'histogram',
};

const RUNTIME_TYPES: ReadonlySet<string> = new Set(['counter', 'gauge', 'histogram', 'summary', 'untyped']);

// Exported for fixture tests: future upstream tokens must degrade to the
// 'unknown' deny sentinel, never widen the runtime union.
export function normalizeManifestType(name: string, upstream: string): Pick<IManifestFamily, 'runtimeType' | 'rawType' | 'definitionMechanism'> {
	if (RUNTIME_TYPES.has(upstream)) {
		return {runtimeType: upstream as RuntimeMetricType, definitionMechanism: 'direct'};
	}
	if (upstream === 'desc') {
		const pinned = DESC_RUNTIME_TYPES[name];
		return pinned
			? {runtimeType: pinned, definitionMechanism: 'desc'}
			: {runtimeType: 'unknown', rawType: upstream, definitionMechanism: 'desc'};
	}
	return {runtimeType: 'unknown', rawType: upstream, definitionMechanism: 'direct'};
}

interface IVendoredFamily {
	name: string;
	owner: string;
	class: string;
	packaged: boolean;
	type: string;
	labels: string[];
	activation: string;
	priority: string;
	privacy: string;
	waiver: string;
}

export const manifestEnvelope = {
	schemaVersion: vendored.schemaVersion,
	sourceCommit: vendored.source.commit,
	vendoredAt: vendored.source.vendoredAt,
};

const families: ReadonlyMap<string, IManifestFamily> = new Map(
	(vendored.manifest.families as IVendoredFamily[]).map(f => [f.name, {
		name: f.name,
		owner: f.owner,
		class: f.class as ManifestClass,
		packaged: f.packaged,
		...normalizeManifestType(f.name, f.type),
		labels: f.labels,
		activation: f.activation,
		priority: f.priority,
		privacy: f.privacy,
		waiver: f.waiver,
	}]),
);

export function getManifestFamily(name: string): IManifestFamily | undefined {
	return families.get(name);
}

export function allManifestFamilies(): IManifestFamily[] {
	return [...families.values()];
}

// Whether a family is part of the gateway scrape contract: listed, class
// "default", packaged, and with a known Prometheus runtime type. Deny by
// default — an unlisted name, an excluded class (standalone-*, aictrl-bridge,
// kv-agent-health, dpu-doca), or an unknown runtime type can never satisfy a
// capability requirement.
export function isGatewayScrapeFamily(name: string): boolean {
	const f = families.get(name);
	return f !== undefined && f.class === 'default' && f.packaged && f.runtimeType !== 'unknown';
}
