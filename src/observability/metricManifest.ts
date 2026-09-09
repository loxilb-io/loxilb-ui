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
// - The extraction mechanism and the Prometheus runtime type are separate
//   concerns, and the UI keeps them in separate fields. Gateway 27680379
//   started saying so upstream too (`definition_mechanism` alongside a real
//   `type`); before it, a custom-collector family arrived as `type: "desc"`
//   and the type had to be pinned in DESC_RUNTIME_TYPES. Both inputs are
//   still accepted, and `desc` must never enter the runtime type union.
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

// How the upstream generator found a family. Since gateway 27680379 the
// manifest states this itself; before that it had to be inferred from a
// `type: "desc"` sentinel, and 'direct' is what that inference produced for
// everything else. Both vocabularies are kept so a manifest vendored from an
// older gateway still loads.
export type DefinitionMechanism = 'promauto' | 'manual' | 'desc' | 'direct';

const DEFINITION_MECHANISMS: ReadonlySet<string> = new Set(['promauto', 'manual', 'desc', 'direct']);

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
//
// `mechanism` is the upstream `definition_mechanism` when the vendored
// manifest carries one. When it does, `type` is already a real Prometheus
// type even for custom-collector families, so DESC_RUNTIME_TYPES stops being
// the source of truth and becomes a cross-check — disagreement means upstream
// changed a collector's type under us, which is a contract change the UI has
// to see rather than silently adopt.
export function normalizeManifestType(name: string, upstream: string, mechanism?: string): Pick<IManifestFamily, 'runtimeType' | 'rawType' | 'definitionMechanism'> {
	if (mechanism !== undefined) {
		const declared: DefinitionMechanism = DEFINITION_MECHANISMS.has(mechanism) ? (mechanism as DefinitionMechanism) : 'direct';
		if (!RUNTIME_TYPES.has(upstream)) return {runtimeType: 'unknown', rawType: upstream, definitionMechanism: declared};
		const runtimeType = upstream as RuntimeMetricType;
		const pinned = DESC_RUNTIME_TYPES[name];
		// Deny on disagreement rather than trusting either side blindly.
		if (pinned !== undefined && pinned !== runtimeType) return {runtimeType: 'unknown', rawType: upstream, definitionMechanism: declared};
		return {runtimeType, definitionMechanism: declared};
	}
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
	// Absent in manifests vendored before gateway 27680379.
	definition_mechanism?: string;
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
		...normalizeManifestType(f.name, f.type, f.definition_mechanism),
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
