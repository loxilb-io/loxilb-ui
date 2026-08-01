import {describe, expect, it} from 'vitest';
import {normalize_metric_names, parse_prometheus_text} from './metrics';

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

// The gateway renamed its whole Prometheus surface to the `loxilb_` namespace
// ahead of public release. normalize_metric_names lets the dashboard cards read
// the canonical new names against both a pre-rename gateway (legacy names, e.g.
// the current testbed) and a post-rename one.
describe('normalize_metric_names', () => {
	it('back-fills canonical loxilb_ names from legacy names (pre-rename gateway)', () => {
		const legacy = {
			lb_rule_count: 4,
			active_conntrack_count: 12,
			healthy_endpoints_count: 3,
			system_cpu_utilization: 55,
			processed_bytes_total: 1000,
			total_errors: 2,
		};
		const out = normalize_metric_names(legacy);
		expect(out.loxilb_lb_rules).toBe(4);
		expect(out.loxilb_active_conntrack_entries).toBe(12);
		expect(out.loxilb_healthy_endpoints).toBe(3);
		expect(out.loxilb_system_cpu_utilization_percent).toBe(55);
		expect(out.loxilb_processed_bytes_total).toBe(1000);
		expect(out.loxilb_errors_total).toBe(2);
	});

	it('prefers the canonical name when both are present and never overwrites it', () => {
		const mixed = {loxilb_lb_rules: 9, lb_rule_count: 4};
		expect(normalize_metric_names(mixed).loxilb_lb_rules).toBe(9);
	});

	it('leaves canonical-only input (post-rename gateway) untouched', () => {
		const modern = {loxilb_active_conntrack_entries: 7, loxilb_conntrack_max_entries: 524288};
		const out = normalize_metric_names(modern);
		expect(out.loxilb_active_conntrack_entries).toBe(7);
		expect(out.loxilb_conntrack_max_entries).toBe(524288);
		// No legacy source → no phantom zero for a metric that simply isn't present.
		expect(out.loxilb_new_flows).toBeUndefined();
	});

	it('does not fabricate a value when neither name is present', () => {
		expect(normalize_metric_names({}).loxilb_lb_rules).toBeUndefined();
	});
});
