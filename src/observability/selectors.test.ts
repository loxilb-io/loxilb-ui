import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {aggregateSum, projectFlatSums, selectFamily, selectSamples, selectScalar} from './selectors';

function snapshotOf(text: string): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: 1_000_000,
		available: parsed.diagnostics.totalSamples > 0,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

const SNAPSHOT = snapshotOf([
	'loxilb_ai_active_streams{model="m1"} 2',
	'loxilb_ai_active_streams{model="m2"} 3',
	'loxilb_ai_active_streams{model="__overflow__"} 1',
	'loxilb_lb_rules 4',
	'weird NaN',
	'hot +Inf',
].join('\n'));

describe('selectSamples', () => {
	it('returns raw per-label series — the raw layer never sums', () => {
		const all = selectSamples(SNAPSHOT, 'loxilb_ai_active_streams');
		expect(all).toHaveLength(3);
	});

	it('filters by exact label match', () => {
		const m1 = selectSamples(SNAPSHOT, 'loxilb_ai_active_streams', {model: 'm1'});
		expect(m1).toHaveLength(1);
		expect(m1[0].value).toBe(2);
	});

	it('answers empty for an absent family instead of throwing', () => {
		expect(selectSamples(SNAPSHOT, 'loxilb_absent_total')).toEqual([]);
	});
});

describe('aggregateSum — the one sanctioned aggregation', () => {
	it('sums finite samples and reports the count', () => {
		const r = aggregateSum(selectSamples(SNAPSHOT, 'loxilb_ai_active_streams'));
		expect(r).toEqual({value: 6, finiteSamples: 3, excludedNonFinite: 0});
	});

	it('excludes non-finite values and says so — never converts them to zero', () => {
		const r = aggregateSum([...selectSamples(SNAPSHOT, 'weird'), ...selectSamples(SNAPSHOT, 'hot')]);
		expect(r.value).toBeUndefined();
		expect(r.excludedNonFinite).toBe(2);
	});

	it('distinguishes "sums to zero" from "no finite data"', () => {
		expect(aggregateSum(selectSamples(snapshotOf('z 0'), 'z')).value).toBe(0);
		expect(aggregateSum([]).value).toBeUndefined();
	});
});

describe('selectScalar', () => {
	it('reads a single-series value', () => {
		expect(selectScalar(SNAPSHOT, 'loxilb_lb_rules')).toBe(4);
	});

	it('refuses to guess when the family unexpectedly has multiple series', () => {
		// A family that grew labels reads as absent — never as a wrong total.
		expect(selectScalar(SNAPSHOT, 'loxilb_ai_active_streams')).toBeUndefined();
		expect(selectScalar(SNAPSHOT, 'loxilb_ai_active_streams', {model: 'm2'})).toBe(3);
	});

	it('a non-finite single sample is absent, not zero', () => {
		expect(selectScalar(SNAPSHOT, 'weird')).toBeUndefined();
	});
});

describe('projectFlatSums — legacy flat card semantics', () => {
	it('sums labeled samples per SAMPLE name and skips non-finite exactly like the legacy parser', () => {
		const flat = projectFlatSums(SNAPSHOT);
		expect(flat['loxilb_ai_active_streams']).toBe(6);
		expect(flat['loxilb_lb_rules']).toBe(4);
		// All-non-finite names stay ABSENT — never zero.
		expect(flat['weird']).toBeUndefined();
		expect(flat['hot']).toBeUndefined();
	});

	it('keeps histogram suffix samples as their own flat keys', () => {
		const flat = projectFlatSums(snapshotOf([
			'# TYPE h histogram',
			'h_bucket{le="1"} 2',
			'h_bucket{le="+Inf"} 3',
			'h_sum 1.5',
			'h_count 3',
		].join('\n')));
		expect(flat['h_bucket']).toBe(5);
		expect(flat['h_sum']).toBe(1.5);
		expect(flat['h_count']).toBe(3);
		expect(flat['h']).toBeUndefined();
	});
});

describe('selectFamily', () => {
	it('exposes family metadata', () => {
		expect(selectFamily(SNAPSHOT, 'loxilb_lb_rules')!.type).toBe('untyped');
		expect(selectFamily(SNAPSHOT, 'loxilb_absent_total')).toBeUndefined();
	});
});
