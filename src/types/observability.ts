//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor} from 'api/capabilities';
import {OpResult} from 'connector/fetcher/opResult';
import {RuntimeMetricType} from 'observability/metricManifest';

//---------------------------------------------------------
// Observability snapshot model (UI-MON-002)
//---------------------------------------------------------
// The label-preserving snapshot the observability surface is built on. The
// raw layer NEVER aggregates: every sample keeps its full label set, and any
// summing/averaging happens in an explicit selector so a page can never
// mistake a per-label series for a total.
//
// Time semantics (recorded at contract freeze): `receivedAtMs` is the UI client's
// fetch-completion time for that Prometheus response — the exposition carries
// no authoritative scrape timestamp, so no server time is claimed. Per-sample
// exposition timestamps, when present, are `sourceTimestampMs`. REST-fed
// panels (worker metrics, GPU status, diagnostics) carry their own
// independent receive/source times and are never atomically consistent with
// a Prometheus snapshot.

export interface IMetricSample {
	// The full sample name as scraped — for histogram/summary series this
	// includes the `_bucket`/`_sum`/`_count` suffix; the owning family is the
	// base name.
	name: string;
	labels: Readonly<Record<string, string>>;
	// Canonical label identity: equal label sets in different orders share
	// this key (sorted, escaped `k="v"` join).
	labelKey: string;
	// May be NaN or ±Infinity — never coerced to zero. A consumer either
	// excludes non-finite values by policy or renders N/A.
	value: number;
	// Optional exposition timestamp (milliseconds), when the line carried one.
	sourceTimestampMs?: number;
}

export interface IMetricFamily {
	name: string;
	// Runtime Prometheus type from the exposition TYPE line; 'untyped' when
	// no TYPE line was seen, 'unknown' (with the raw token preserved) for a
	// token this build does not recognize — an unknown-typed family can never
	// satisfy a capability requirement.
	type: RuntimeMetricType;
	rawType?: string;
	help?: string;
	samples: readonly IMetricSample[];
}

export interface ISnapshotDiagnostics {
	// Lines that looked like samples but could not be parsed, plus duplicate
	// series identities. Skipped content never invalidates the snapshot but
	// stays visible here.
	skippedSamples: number;
	warnings: readonly string[];
	// Samples parsed into the snapshot, dependency families included.
	totalSamples: number;
	// Families on the scrape that belong to the runtime, not the product
	// contract (go_* / process_* / promhttp_*). Parsed and retained so
	// compatibility projections keep working, but excluded from the contract
	// family count and never registrable.
	dependencyFamilies: number;
}

// A limit breach is a typed error, never a silent truncation.
export type ExpositionLimitKind = 'body_bytes' | 'sample_count' | 'label_length' | 'line_length';

export interface IExpositionLimitError {
	kind: ExpositionLimitKind;
	limit: number;
	observed: number;
}

export interface IParseResult {
	families: ReadonlyMap<string, IMetricFamily>;
	diagnostics: ISnapshotDiagnostics;
	// Set when a hard limit was exceeded; families/diagnostics describe what
	// was parsed up to the breach for diagnostics display only.
	limitError?: IExpositionLimitError;
}

export interface IMetricsSnapshot {
	instanceId: number;
	flavor: InstanceFlavor;
	// Client fetch-completion time. Not a server timestamp.
	receivedAtMs: number;
	// True when the body yielded at least one parseable sample: separates
	// "we do not know these numbers" from "these numbers are zero".
	available: boolean;
	// Present when the scrape did not confirm: 503 collection-disabled maps
	// to `unavailable`, 401/403 to `denied`, a limit breach to `failed`.
	failure?: OpResult;
	families: ReadonlyMap<string, IMetricFamily>;
	diagnostics: ISnapshotDiagnostics;
}

//---------------------------------------------------------
// Freshness (recorded contract-freeze decision)
//---------------------------------------------------------
// Classified per source against that source's own cadence — never one global
// constant per page: fresh < 1.5×, aging 1.5–3×, stale ≥ 3× the interval.

export type Freshness = 'fresh' | 'aging' | 'stale';

export function classifyFreshness(receivedAtMs: number, nowMs: number, cadenceMs: number): Freshness {
	const age = nowMs - receivedAtMs;
	if (age < cadenceMs * 1.5) return 'fresh';
	if (age < cadenceMs * 3) return 'aging';
	return 'stale';
}

//---------------------------------------------------------
// Ten-state view model (request state table, UI-MON-005)
//---------------------------------------------------------
// The discriminated union every observability panel renders through. `zero`
// is deliberately NOT a member: a series that exists with value 0 is ordinary
// data (`ready`) and the widget renders the number — synthesizing a state for
// it is how zeros and no-data get conflated.

export type ObservabilityViewState =
	// First request in flight — skeleton, never a synthesized previous zero.
	| {kind: 'loading'}
	// Applicable view, selector produced nothing (lazy series not emitted).
	| {kind: 'no-data'}
	// Not applicable to this product/flavor/topology — neutral, no error color.
	| {kind: 'not-applicable'}
	// Feature/metric explicitly reported disabled by its authoritative source.
	| {kind: 'disabled'; reasonKey?: string}
	// 401/403 — never an empty chart.
	| {kind: 'denied'; failure: OpResult}
	// Transport / 5xx / 503 / parser-limit failure.
	| {kind: 'unavailable'; failure: OpResult}
	// Data present but the freshness threshold is exceeded — last value stays
	// visible with the stale badge, never a healthy color.
	| {kind: 'stale'; receivedAtMs: number}
	// Some families/rows parsed, some skipped — data plus visible diagnostics.
	| {kind: 'partial'; skippedSamples: number; warnings: readonly string[]}
	// A new enum/reason/type this build does not know — raw fallback, never
	// hidden, never zero.
	| {kind: 'unknown'; raw: string}
	| {kind: 'ready'};
