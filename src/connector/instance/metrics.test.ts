import {describe, expect, it} from 'vitest';
import {parse_prometheus_text} from './metrics';

// The dashboard's live cards depend on this parser reading the gateway's
// /netlox/v1/metrics Prometheus exposition correctly.
describe('parse_prometheus_text', () => {
	it('parses plain samples', () => {
		const text = ['lb_rule_count 3', 'rps_bps 1234.5', 'active_conntrack_count 6'].join('\n');
		expect(parse_prometheus_text(text)).toEqual({lb_rule_count: 3, rps_bps: 1234.5, active_conntrack_count: 6});
	});

	it('ignores comments, blank lines and malformed lines', () => {
		const text = [
			'# HELP lb_rule_count Number of LB rules',
			'# TYPE lb_rule_count gauge',
			'',
			'not a metric line !!!',
			'lb_rule_count 2',
		].join('\n');
		expect(parse_prometheus_text(text)).toEqual({lb_rule_count: 2});
	});

	it('sums labeled samples of the same metric (flat snapshot semantics)', () => {
		const text = [
			'healthy_endpoints_count{service="a"} 2',
			'healthy_endpoints_count{service="b"} 3',
		].join('\n');
		expect(parse_prometheus_text(text)).toEqual({healthy_endpoints_count: 5});
	});

	it('handles scientific notation and negative values', () => {
		const text = ['total_bytes 1.5e+06', 'drift -2.5'].join('\n');
		expect(parse_prometheus_text(text)).toEqual({total_bytes: 1_500_000, drift: -2.5});
	});

	it('skips non-finite values instead of poisoning the snapshot', () => {
		// NaN/Inf appear in real exporters; the regex should reject them and,
		// even if matched, non-finite numbers must not land in the map.
		const text = ['broken_metric NaN', 'other +Inf', 'ok_metric 1'].join('\n');
		expect(parse_prometheus_text(text)).toEqual({ok_metric: 1});
	});

	it('returns an empty map for an empty body', () => {
		expect(parse_prometheus_text('')).toEqual({});
	});
});
