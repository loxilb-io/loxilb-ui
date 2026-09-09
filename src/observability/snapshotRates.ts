//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {computeCounterRate, RateResult} from './rates';
import {aggregateSum, selectSamples} from './selectors';

//---------------------------------------------------------
// Snapshot-pair rate selectors (UI-MON-003/007)
//---------------------------------------------------------
// Per-label-group counter rates derived from the shared snapshot history.
// Grouping first sums the family's finite samples within each group (an
// explicit aggregation), then diffs the two most recent observations. Both
// snapshots come from the same retention ring, so every rate on a page
// reflects the same pair of receive times.

// Rates tolerate one missed poll of the 10-second shared cadence before
// reporting a gap instead of averaging over unknown dead time.
export const RATE_MAX_GAP_MS = 35_000;

/**
 * Gap tolerance for a given network cadence: 3.5× the interval (the default
 * 35 s at the 10 s default cadence). A slower operator-selected cadence must
 * scale this up, or every healthy interval would misreport as a gap; callers
 * reading the shared snapshot pass `rateMaxGapMs(cadenceMs)` through.
 */
export function rateMaxGapMs(cadenceMs: number): number {
	return Math.round(cadenceMs * 3.5);
}

export interface IGroupRate {
	labels: Readonly<Record<string, string>>;
	rate: RateResult;
	// The group's current summed value (undefined when no finite sample).
	current: number | undefined;
}

function groupKeyOf(labels: Record<string, string>, groupBy: readonly string[]): string {
	return groupBy.map(k => `${k}=${labels[k] ?? ''}`).join(String.fromCharCode(0));
}

function groupSums(
	snapshot: IMetricsSnapshot,
	family: string,
	groupBy: readonly string[],
): Map<string, {labels: Record<string, string>; value: number | undefined}> {
	const byGroup = new Map<string, {labels: Record<string, string>; samples: ReturnType<typeof selectSamples>}>();
	for (const s of selectSamples(snapshot, family)) {
		const key = groupKeyOf({...s.labels}, groupBy);
		let g = byGroup.get(key);
		if (!g) {
			const labels: Record<string, string> = {};
			for (const k of groupBy) if (s.labels[k] !== undefined) labels[k] = s.labels[k];
			g = {labels, samples: []};
			byGroup.set(key, g);
		}
		g.samples.push(s);
	}
	const out = new Map<string, {labels: Record<string, string>; value: number | undefined}>();
	for (const [key, g] of byGroup) out.set(key, {labels: g.labels, value: aggregateSum(g.samples).value});
	return out;
}

/**
 * Per-group counter rates between the two most recent snapshots of the
 * retention ring. A group present now but absent before (a freshly minted
 * label set) reports insufficient-samples until its second observation.
 */
export function groupRates(
	history: readonly IMetricsSnapshot[],
	family: string,
	groupBy: readonly string[],
	maxGapMs: number = RATE_MAX_GAP_MS,
): IGroupRate[] {
	const current = history[history.length - 1];
	const previous = history.length >= 2 ? history[history.length - 2] : undefined;
	if (!current) return [];

	const now = groupSums(current, family, groupBy);
	const before = previous ? groupSums(previous, family, groupBy) : undefined;

	const out: IGroupRate[] = [];
	for (const [key, g] of now) {
		const prev = before?.get(key);
		const rate = computeCounterRate(
			prev?.value !== undefined && previous ? {value: prev.value, receivedAtMs: previous.receivedAtMs} : undefined,
			g.value !== undefined ? {value: g.value, receivedAtMs: current.receivedAtMs} : undefined,
			maxGapMs,
		);
		out.push({labels: g.labels, rate, current: g.value});
	}
	return out;
}

/** Whole-family sum rate (groupBy nothing): one explicit total. */
export function familySumRate(history: readonly IMetricsSnapshot[], family: string, maxGapMs: number = RATE_MAX_GAP_MS): RateResult {
	const rates = groupRates(history, family, [], maxGapMs);
	return rates.length === 1 ? rates[0].rate : {kind: 'insufficient-samples'};
}
