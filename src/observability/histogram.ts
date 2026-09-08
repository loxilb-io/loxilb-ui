//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricFamily, IMetricSample} from 'types/observability';

//---------------------------------------------------------
// Histogram extraction and quantile estimation (UI-MON-003)
//---------------------------------------------------------
// Histograms stay raw in the snapshot (`_bucket{le}`/`_sum`/`_count` samples
// with every grouping label). This module turns one grouping-label series
// into validated buckets and estimates quantiles, with the request-contract
// rule: a quantile is N/A — a typed reason, never a guess — when bucket
// monotonicity or completeness validation fails, and when the quantile lands
// in the +Inf bucket (e.g. the P/D ladders cap at 10 s, so a p99 above the
// ladder is not resolvable).

export interface IHistogramBucket {
	le: number; // upper bound; Infinity for the +Inf bucket
	cumulative: number;
}

export interface IHistogramSeries {
	labels: Readonly<Record<string, string>>;
	buckets: readonly IHistogramBucket[];
	sum?: number;
	count: number;
}

export type HistogramInvalidReason =
	| 'no-buckets'
	| 'missing-inf-bucket'
	| 'non-monotonic'
	| 'count-mismatch'
	| 'non-finite';

export type HistogramResult =
	| {kind: 'ok'; series: IHistogramSeries}
	| {kind: 'invalid'; reason: HistogramInvalidReason};

// Groups a histogram family's samples by their non-`le` label identity and
// validates the series for the given grouping labels (exact match on every
// non-`le` label).
export function extractHistogramSeries(
	family: IMetricFamily,
	groupLabels: Readonly<Record<string, string>> = {},
): HistogramResult {
	const wanted = Object.entries(groupLabels);
	const belongs = (s: IMetricSample) => {
		const rest = Object.entries(s.labels).filter(([k]) => k !== 'le');
		if (rest.length !== wanted.length) return false;
		return wanted.every(([k, v]) => s.labels[k] === v);
	};

	const buckets: IHistogramBucket[] = [];
	let sum: number | undefined;
	let count: number | undefined;
	for (const s of family.samples) {
		if (!belongs(s)) continue;
		if (s.name.endsWith('_bucket')) {
			const raw = s.labels['le'];
			if (raw === undefined) continue;
			const le = raw === '+Inf' ? Infinity : Number(raw);
			if (Number.isNaN(le) || !Number.isFinite(s.value)) return {kind: 'invalid', reason: 'non-finite'};
			buckets.push({le, cumulative: s.value});
		} else if (s.name.endsWith('_sum')) {
			sum = s.value;
		} else if (s.name.endsWith('_count')) {
			if (!Number.isFinite(s.value)) return {kind: 'invalid', reason: 'non-finite'};
			count = s.value;
		}
	}

	if (buckets.length === 0) return {kind: 'invalid', reason: 'no-buckets'};
	buckets.sort((a, b) => a.le - b.le);

	const inf = buckets[buckets.length - 1];
	if (inf.le !== Infinity) return {kind: 'invalid', reason: 'missing-inf-bucket'};
	for (let i = 1; i < buckets.length; i++) {
		if (buckets[i].cumulative < buckets[i - 1].cumulative) return {kind: 'invalid', reason: 'non-monotonic'};
	}
	// Completeness: the +Inf bucket IS the observation count; a disagreeing
	// _count means the scrape caught a torn series.
	if (count !== undefined && count !== inf.cumulative) return {kind: 'invalid', reason: 'count-mismatch'};

	return {kind: 'ok', series: {labels: groupLabels, buckets, sum, count: inf.cumulative}};
}

export type QuantileResult =
	| {kind: 'ok'; value: number}
	| {kind: 'empty'}          // zero observations — N/A, not 0
	| {kind: 'above-ladder'};  // quantile falls in the +Inf bucket — not resolvable

// Prometheus-style linear interpolation inside the winning bucket. `q` in
// (0, 1]. Where Prometheus's histogram_quantile would fabricate the highest
// finite bound for a +Inf landing, this returns a typed above-ladder result
// instead (the request-contract N/A rule).
export function estimateQuantile(series: IHistogramSeries, q: number): QuantileResult {
	const total = series.buckets[series.buckets.length - 1].cumulative;
	if (total === 0) return {kind: 'empty'};

	const rank = q * total;
	let idx = 0;
	while (idx < series.buckets.length && series.buckets[idx].cumulative < rank) idx++;
	if (idx >= series.buckets.length - 1 && series.buckets[series.buckets.length - 1].le === Infinity) {
		// Winning bucket is +Inf (or only +Inf exists) — above the ladder,
		// unless a finite bucket already covered the rank.
		if (idx === series.buckets.length - 1) return {kind: 'above-ladder'};
	}

	const bucket = series.buckets[idx];
	if (bucket.le === Infinity) return {kind: 'above-ladder'};
	const prevCumulative = idx > 0 ? series.buckets[idx - 1].cumulative : 0;
	const prevLe = idx > 0 ? series.buckets[idx - 1].le : 0;
	const inBucket = bucket.cumulative - prevCumulative;
	if (inBucket <= 0) return {kind: 'ok', value: bucket.le};
	return {kind: 'ok', value: prevLe + ((bucket.le - prevLe) * (rank - prevCumulative)) / inBucket};
}
