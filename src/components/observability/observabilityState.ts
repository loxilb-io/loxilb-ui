//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {classifyFreshness, IMetricsSnapshot, ObservabilityViewState} from 'types/observability';

//---------------------------------------------------------
// Ten-state classifier (UI-MON-005)
//---------------------------------------------------------
// The one precedence table that turns "what do we know about this panel"
// into the discriminated view state every observability panel renders
// through. Kept separate from the rendering (ObservabilityStateFrame) so the
// precedence rules are unit-testable as a table, without a DOM — the same
// split as pageState/PageStateBanner.
//
// Ordering rationale:
// 1. Applicability comes first and is a CONTRACT decision (registry), never
//    inferred from sample absence — an applicable panel with a lazy series
//    that emitted nothing is `no-data`, not `not-applicable`.
// 2. An authoritative disabled signal (e.g. `/config/gpu/status.enabled ===
//    false`) beats transport states: the feature being off explains any
//    other symptom.
// 3. A denied scrape must never fall through to an empty-looking state.
// 4. Stale beats partial/no-data: when the last observation is too old, its
//    contents are secondary to its age.

export interface IViewStateInput {
	// From the capability registry — never from data presence.
	applicable: boolean;
	// First request in flight (no observation yet).
	isLoading: boolean;
	snapshot: IMetricsSnapshot | undefined;
	// Whether the panel's selector produced something renderable. A valid
	// zero IS data — widgets render `0`, this layer never synthesizes a state
	// for it.
	hasData: boolean;
	nowMs: number;
	cadenceMs: number;
	// Locale key for an explicit, authoritatively-reported disabled state.
	disabledReasonKey?: string;
}

export function classifyViewState(input: IViewStateInput): ObservabilityViewState {
	const {applicable, isLoading, snapshot, hasData, nowMs, cadenceMs, disabledReasonKey} = input;

	if (!applicable) return {kind: 'not-applicable'};
	if (disabledReasonKey !== undefined) return {kind: 'disabled', reasonKey: disabledReasonKey};
	// No observation yet — whether the request is in flight or about to be,
	// the honest answer is a skeleton (never a synthesized previous zero).
	if (!snapshot || isLoading) return {kind: 'loading'};

	if (snapshot.failure) {
		if (snapshot.failure.status === 'denied') return {kind: 'denied', failure: snapshot.failure};
		return {kind: 'unavailable', failure: snapshot.failure};
	}

	if (classifyFreshness(snapshot.receivedAtMs, nowMs, cadenceMs) === 'stale') {
		return {kind: 'stale', receivedAtMs: snapshot.receivedAtMs};
	}

	if (snapshot.diagnostics.skippedSamples > 0) {
		return {
			kind: 'partial',
			skippedSamples: snapshot.diagnostics.skippedSamples,
			warnings: snapshot.diagnostics.warnings,
		};
	}

	if (!hasData) return {kind: 'no-data'};
	return {kind: 'ready'};
}

// For widgets that meet a value outside their pinned vocabulary (a new enum,
// reason, or type): show the raw token safely rather than hiding the row or
// coercing it to zero.
export function unknownValueState(raw: string): ObservabilityViewState {
	return {kind: 'unknown', raw};
}
