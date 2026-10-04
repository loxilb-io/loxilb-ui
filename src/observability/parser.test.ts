import {describe, expect, it} from 'vitest';
import {EXPOSITION_LIMITS, isDependencyFamily, labelKeyOf, parseExposition} from './parser';

describe('parseExposition — grammar', () => {
	it('parses plain and labeled samples with full label preservation', () => {
		const r = parseExposition([
			'loxilb_lb_rules 3',
			'loxilb_ai_requests_total{model="m1",tenant="t1",status="ok"} 5',
			'loxilb_ai_requests_total{model="m1",tenant="t2",status="ok"} 7',
		].join('\n'));

		expect(r.limitError).toBeUndefined();
		expect(r.diagnostics.totalSamples).toBe(3);
		expect(r.families.get('loxilb_lb_rules')!.samples[0].value).toBe(3);

		const ai = r.families.get('loxilb_ai_requests_total')!;
		expect(ai.samples).toHaveLength(2);
		// The raw layer never sums: both series survive with their labels.
		expect(ai.samples.map(s => s.labels.tenant).sort()).toEqual(['t1', 't2']);
	});

	it('reads HELP and TYPE metadata, unknown TYPE tokens degrade to the deny sentinel', () => {
		const r = parseExposition([
			'# HELP loxilb_lb_rules Number of LB rules',
			'# TYPE loxilb_lb_rules gauge',
			'loxilb_lb_rules 2',
			'# TYPE weird_family info',
			'weird_family 1',
		].join('\n'));

		const f = r.families.get('loxilb_lb_rules')!;
		expect(f.type).toBe('gauge');
		expect(f.help).toBe('Number of LB rules');

		const weird = r.families.get('weird_family')!;
		expect(weird.type).toBe('unknown');
		expect(weird.rawType).toBe('info');
	});

	it('a family without a TYPE line is untyped, not unknown', () => {
		expect(parseExposition('naked_metric 1').families.get('naked_metric')!.type).toBe('untyped');
	});

	it('handles quoted-label escapes: backslash, quote, newline', () => {
		const r = parseExposition('m{path="C:\\\\dir",msg="say \\"hi\\"",multi="a\\nb"} 1');
		const s = r.families.get('m')!.samples[0];
		expect(s.labels.path).toBe('C:\\dir');
		expect(s.labels.msg).toBe('say "hi"');
		expect(s.labels.multi).toBe('a\nb');
	});

	it('gives equal label sets in different orders the same canonical identity', () => {
		expect(labelKeyOf({b: '2', a: '1'})).toBe(labelKeyOf({a: '1', b: '2'}));
		// … which makes the re-emission a duplicate, kept-first:
		const r = parseExposition(['m{a="1",b="2"} 5', 'm{b="2",a="1"} 9'].join('\n'));
		expect(r.families.get('m')!.samples).toHaveLength(1);
		expect(r.families.get('m')!.samples[0].value).toBe(5);
		expect(r.diagnostics.skippedSamples).toBe(1);
	});

	it('preserves NaN and ±Inf instead of converting them to zero', () => {
		const r = parseExposition(['a NaN', 'b +Inf', 'c -Inf', 'd 1'].join('\n'));
		expect(r.families.get('a')!.samples[0].value).toBeNaN();
		expect(r.families.get('b')!.samples[0].value).toBe(Infinity);
		expect(r.families.get('c')!.samples[0].value).toBe(-Infinity);
		expect(r.diagnostics.totalSamples).toBe(4);
		expect(r.diagnostics.skippedSamples).toBe(0);
	});

	it('parses the full number grammar including signed exponents', () => {
		const r = parseExposition(['a 7.9598e-05', 'b 1.25E+3', 'c .5e-2', 'd -2.5'].join('\n'));
		expect(r.families.get('a')!.samples[0].value).toBeCloseTo(7.9598e-5);
		expect(r.families.get('b')!.samples[0].value).toBe(1250);
		expect(r.families.get('c')!.samples[0].value).toBe(0.005);
		expect(r.families.get('d')!.samples[0].value).toBe(-2.5);
	});

	it('reads optional per-sample timestamps as sourceTimestampMs', () => {
		const r = parseExposition(['with_ts 4 1725765000000', 'without_ts 2'].join('\n'));
		expect(r.families.get('with_ts')!.samples[0].sourceTimestampMs).toBe(1725765000000);
		expect(r.families.get('without_ts')!.samples[0].sourceTimestampMs).toBeUndefined();
	});

	it('skips malformed lines with diagnostics, never invalidating the snapshot', () => {
		const r = parseExposition([
			'ok_metric 1',
			'not a metric line !!!',
			'broken{unclosed="x 2',
			'"Prometheus option is disabled."',
			'valueless_metric',
		].join('\n'));

		expect(r.limitError).toBeUndefined();
		expect(r.diagnostics.totalSamples).toBe(1);
		expect(r.diagnostics.skippedSamples).toBe(4);
		expect(r.diagnostics.warnings.length).toBeGreaterThan(0);
		expect(r.families.get('ok_metric')!.samples[0].value).toBe(1);
	});
});

describe('parseExposition — histogram/summary suffix grouping', () => {
	const HISTOGRAM = [
		'# TYPE loxilb_ai_request_duration_seconds histogram',
		'loxilb_ai_request_duration_seconds_bucket{model="m",tenant="t",le="0.1"} 4',
		'loxilb_ai_request_duration_seconds_bucket{model="m",tenant="t",le="1"} 9',
		'loxilb_ai_request_duration_seconds_bucket{model="m",tenant="t",le="+Inf"} 10',
		'loxilb_ai_request_duration_seconds_sum{model="m",tenant="t"} 12.5',
		'loxilb_ai_request_duration_seconds_count{model="m",tenant="t"} 10',
	].join('\n');

	it('groups _bucket/_sum/_count under the TYPE-declared histogram family', () => {
		const r = parseExposition(HISTOGRAM);
		const f = r.families.get('loxilb_ai_request_duration_seconds')!;
		expect(f.type).toBe('histogram');
		expect(f.samples).toHaveLength(5);
		expect(r.families.has('loxilb_ai_request_duration_seconds_bucket')).toBe(false);
		// The sample names keep their suffixes inside the family.
		expect(f.samples.filter(s => s.name.endsWith('_bucket'))).toHaveLength(3);
	});

	it('does NOT fold suffixed names into a family that is not histogram/summary typed', () => {
		const r = parseExposition(['# TYPE foo counter', 'foo 1', 'foo_bucket{le="1"} 2'].join('\n'));
		expect(r.families.get('foo')!.samples).toHaveLength(1);
		expect(r.families.get('foo_bucket')!.samples).toHaveLength(1);
	});

	it('keeps a summary family together, but _bucket stays separate there', () => {
		const r = parseExposition([
			'# TYPE s summary',
			's{quantile="0.5"} 1',
			's_sum 3',
			's_count 2',
			's_bucket{le="1"} 9',
		].join('\n'));
		expect(r.families.get('s')!.samples).toHaveLength(3);
		expect(r.families.get('s_bucket')!.samples).toHaveLength(1);
	});
});

describe('parseExposition — typed limits, not silent truncation', () => {
	it('a label value beyond the limit is a typed error', () => {
		const big = 'x'.repeat(EXPOSITION_LIMITS.labelLength + 1);
		const r = parseExposition(`m{v="${big}"} 1`);
		expect(r.limitError).toMatchObject({kind: 'label_length', limit: EXPOSITION_LIMITS.labelLength});
	});

	it('an oversized line is a typed error', () => {
		const r = parseExposition(`m 1\n${'#'.repeat(EXPOSITION_LIMITS.lineLength + 1)}\n`);
		expect(r.limitError).toMatchObject({kind: 'line_length'});
	});

	it('lazy TYPE-only families stay in the map with zero samples', () => {
		// The QoS custom collector emits nothing until a service is shaped —
		// the family's existence must still be representable.
		const r = parseExposition('# TYPE loxilb_proxy_qos_parks_total counter');
		const f = r.families.get('loxilb_proxy_qos_parks_total')!;
		expect(f.type).toBe('counter');
		expect(f.samples).toHaveLength(0);
	});
});

describe('dependency families', () => {
	it('are parsed and retained but flagged in diagnostics', () => {
		const r = parseExposition(['go_goroutines 12', 'process_cpu_seconds_total 3', 'loxilb_lb_rules 1'].join('\n'));
		expect(r.families.has('go_goroutines')).toBe(true);
		expect(r.diagnostics.dependencyFamilies).toBe(2);
		expect(isDependencyFamily('go_goroutines')).toBe(true);
		expect(isDependencyFamily('promhttp_metric_handler_requests_total')).toBe(true);
		expect(isDependencyFamily('loxilb_lb_rules')).toBe(false);
	});
});
