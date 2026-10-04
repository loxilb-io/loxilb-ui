//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricFamily, IMetricSample, IMetricsSnapshot} from 'types/observability';

//---------------------------------------------------------
// Selector layer (UI-MON-003)
//---------------------------------------------------------
// The ONLY place aggregation happens. The snapshot's raw layer keeps every
// label; a widget that needs a total goes through an explicit selector so a
// per-label series can never silently masquerade as an aggregate. Non-finite
// samples (NaN/±Inf) are never converted to zero — aggregations exclude them
// and report how many they excluded, so the widget can render N/A or a
// diagnostic instead of a fabricated number.

export function selectFamily(snapshot: IMetricsSnapshot, name: string): IMetricFamily | undefined {
	return snapshot.families.get(name);
}

// Samples of `name` (the full sample name, so `foo_bucket` works) whose
// labels contain every `match` entry with exactly that value.
export function selectSamples(
	snapshot: IMetricsSnapshot,
	familyName: string,
	match?: Readonly<Record<string, string>>,
): IMetricSample[] {
	const family = snapshot.families.get(familyName);
	if (!family) return [];
	if (!match || Object.keys(match).length === 0) return [...family.samples];
	return family.samples.filter(s => Object.entries(match).every(([k, v]) => s.labels[k] === v));
}

export interface IAggregateResult {
	// Sum of the finite samples; undefined when not one finite sample exists
	// (so "no data" and "sums to zero" stay distinguishable).
	value: number | undefined;
	finiteSamples: number;
	excludedNonFinite: number;
}

// Explicit sum across samples. This is the one sanctioned way to collapse a
// labeled family to a scalar.
export function aggregateSum(samples: readonly IMetricSample[]): IAggregateResult {
	let sum = 0;
	let finite = 0;
	let excluded = 0;
	for (const s of samples) {
		if (Number.isFinite(s.value)) {
			sum += s.value;
			finite++;
		} else {
			excluded++;
		}
	}
	return {value: finite > 0 ? sum : undefined, finiteSamples: finite, excludedNonFinite: excluded};
}

// A single-series scalar read: exactly one sample (after optional label
// match) with a finite value, else undefined. Never sums — a family that
// unexpectedly grew labels reads as absent rather than as a wrong total.
export function selectScalar(
	snapshot: IMetricsSnapshot,
	familyName: string,
	match?: Readonly<Record<string, string>>,
): number | undefined {
	const samples = selectSamples(snapshot, familyName, match);
	if (samples.length !== 1 || !Number.isFinite(samples[0].value)) return undefined;
	return samples[0].value;
}

//---------------------------------------------------------
// Legacy flat projection (UI-MON-006 compatibility)
//---------------------------------------------------------
// Reproduces the legacy dashboard parser's flat semantics as an explicit
// selector over the snapshot: every SAMPLE name (histogram suffixes stay
// distinct keys) maps to the sum of its finite values; non-finite samples
// are skipped exactly as the old isFinite guard did, and a name whose every
// sample is non-finite stays ABSENT — never zero.
export function projectFlatSums(snapshot: IMetricsSnapshot): Record<string, number> {
	const flat: Record<string, number> = {};
	for (const family of snapshot.families.values()) {
		for (const s of family.samples) {
			if (!Number.isFinite(s.value)) continue;
			flat[s.name] = (flat[s.name] ?? 0) + s.value;
		}
	}
	return flat;
}
