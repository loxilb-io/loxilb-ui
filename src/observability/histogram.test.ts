import {describe, expect, it} from 'vitest';
import {parseExposition} from './parser';
import {estimateQuantile, extractHistogramSeries, HistogramResult, mergeHistogramSeries} from './histogram';

function familyOf(text: string, name: string) {
	const f = parseExposition(text).families.get(name);
	if (!f) throw new Error(`family ${name} missing from fixture`);
	return f;
}

// Mirrors the gateway's P/D ladders (0.001…10): a >10 s observation lands in
// +Inf, which is exactly the above-ladder case the N/A rule exists for.
const PD_TTFT = [
	'# TYPE loxilb_ai_pd_decode_ttft_seconds histogram',
	'loxilb_ai_pd_decode_ttft_seconds_bucket{model="m",le="0.1"} 10',
	'loxilb_ai_pd_decode_ttft_seconds_bucket{model="m",le="1"} 80',
	'loxilb_ai_pd_decode_ttft_seconds_bucket{model="m",le="10"} 90',
	'loxilb_ai_pd_decode_ttft_seconds_bucket{model="m",le="+Inf"} 100',
	'loxilb_ai_pd_decode_ttft_seconds_sum{model="m"} 123.4',
	'loxilb_ai_pd_decode_ttft_seconds_count{model="m"} 100',
].join('\n');

describe('extractHistogramSeries', () => {
	it('extracts and validates one grouping-label series', () => {
		const r = extractHistogramSeries(familyOf(PD_TTFT, 'loxilb_ai_pd_decode_ttft_seconds'), {model: 'm'});
		expect(r.kind).toBe('ok');
		const series = (r as Extract<HistogramResult, {kind: 'ok'}>).series;
		expect(series.count).toBe(100);
		expect(series.sum).toBe(123.4);
		expect(series.buckets.map(b => b.le)).toEqual([0.1, 1, 10, Infinity]);
	});

	it('a different grouping label set finds no buckets', () => {
		const r = extractHistogramSeries(familyOf(PD_TTFT, 'loxilb_ai_pd_decode_ttft_seconds'), {model: 'other'});
		expect(r).toEqual({kind: 'invalid', reason: 'no-buckets'});
	});

	it('rejects a series with no +Inf bucket', () => {
		const f = familyOf(['# TYPE h histogram', 'h_bucket{le="1"} 2', 'h_count 2'].join('\n'), 'h');
		expect(extractHistogramSeries(f)).toEqual({kind: 'invalid', reason: 'missing-inf-bucket'});
	});

	it('rejects non-monotonic cumulative buckets', () => {
		const f = familyOf(
			['# TYPE h histogram', 'h_bucket{le="1"} 5', 'h_bucket{le="2"} 3', 'h_bucket{le="+Inf"} 6'].join('\n'),
			'h',
		);
		expect(extractHistogramSeries(f)).toEqual({kind: 'invalid', reason: 'non-monotonic'});
	});

	it('rejects a _count that disagrees with the +Inf bucket (torn series)', () => {
		const f = familyOf(
			['# TYPE h histogram', 'h_bucket{le="1"} 2', 'h_bucket{le="+Inf"} 6', 'h_count 7'].join('\n'),
			'h',
		);
		expect(extractHistogramSeries(f)).toEqual({kind: 'invalid', reason: 'count-mismatch'});
	});
});

describe('mergeHistogramSeries — explicit cross-series aggregation', () => {
	it('merges every grouping-label series by summing per-bound counts', () => {
		const f = familyOf([
			'# TYPE h histogram',
			'h_bucket{model="a",le="1"} 2',
			'h_bucket{model="a",le="+Inf"} 4',
			'h_sum{model="a"} 3.5',
			'h_count{model="a"} 4',
			'h_bucket{model="b",le="1"} 10',
			'h_bucket{model="b",le="+Inf"} 10',
			'h_sum{model="b"} 1.5',
			'h_count{model="b"} 10',
		].join('\n'), 'h');
		const r = mergeHistogramSeries(f);
		expect(r.kind).toBe('ok');
		const s = (r as Extract<HistogramResult, {kind: 'ok'}>).series;
		expect(s.buckets).toEqual([
			{le: 1, cumulative: 12},
			{le: Infinity, cumulative: 14},
		]);
		expect(s.count).toBe(14);
		expect(s.sum).toBe(5);
	});

	it('divergent bucket ladders are typed invalid, never a partial merge', () => {
		const f = familyOf([
			'# TYPE h histogram',
			'h_bucket{model="a",le="1"} 2',
			'h_bucket{model="a",le="+Inf"} 4',
			'h_bucket{model="b",le="2"} 1',
			'h_bucket{model="b",le="+Inf"} 1',
		].join('\n'), 'h');
		expect(mergeHistogramSeries(f)).toEqual({kind: 'invalid', reason: 'ladder-mismatch'});
	});

	it('one invalid constituent series invalidates the merge', () => {
		const f = familyOf([
			'# TYPE h histogram',
			'h_bucket{model="a",le="1"} 5',
			'h_bucket{model="a",le="2"} 3', // non-monotonic
			'h_bucket{model="a",le="+Inf"} 6',
		].join('\n'), 'h');
		expect(mergeHistogramSeries(f)).toEqual({kind: 'invalid', reason: 'non-monotonic'});
	});

	it('an empty family has no buckets to merge', () => {
		const f = familyOf('# TYPE h histogram', 'h');
		expect(mergeHistogramSeries(f)).toEqual({kind: 'invalid', reason: 'no-buckets'});
	});
});

describe('estimateQuantile', () => {
	const okSeries = () => {
		const r = extractHistogramSeries(familyOf(PD_TTFT, 'loxilb_ai_pd_decode_ttft_seconds'), {model: 'm'});
		return (r as Extract<HistogramResult, {kind: 'ok'}>).series;
	};

	it('interpolates inside the winning bucket', () => {
		// p50 rank = 50 of 100 → bucket (0.1, 1] holds ranks 11..80:
		// 0.1 + 0.9 * (50-10)/70 ≈ 0.614
		const r = estimateQuantile(okSeries(), 0.5);
		expect(r.kind).toBe('ok');
		expect((r as Extract<typeof r, {kind: 'ok'}>).value).toBeCloseTo(0.1 + (0.9 * 40) / 70, 6);
	});

	it('a quantile that lands in +Inf is above-ladder N/A — never the top finite bound', () => {
		// rank 95 of 100 falls beyond the le="10" bucket (90): Prometheus
		// would answer 10s here; the contract renders N/A instead.
		expect(estimateQuantile(okSeries(), 0.95)).toEqual({kind: 'above-ladder'});
	});

	it('zero observations are empty N/A, not 0', () => {
		const f = familyOf(
			['# TYPE h histogram', 'h_bucket{le="1"} 0', 'h_bucket{le="+Inf"} 0', 'h_count 0'].join('\n'),
			'h',
		);
		const r = extractHistogramSeries(f);
		const series = (r as Extract<HistogramResult, {kind: 'ok'}>).series;
		expect(estimateQuantile(series, 0.99)).toEqual({kind: 'empty'});
	});
});
