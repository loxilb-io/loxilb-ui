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

// The Prometheus surface is not covered by the swagger spec, so neither the
// generated capability map nor the subset contract test can police it. These
// fixtures are the only guard: each is the real name set scraped from that
// backend, so a future rename on either side fails here instead of silently
// blanking a dashboard card.
describe('normalize_metric_names', () => {
	// ---- loxilb-inference-gateway ----
	describe('inference-gateway flavor', () => {
		it('back-fills canonical loxilb_ names from legacy names (pre-rename gateway)', () => {
			const legacy = {
				lb_rule_count: 4,
				active_conntrack_count: 12,
				healthy_endpoints_count: 3,
				system_cpu_utilization: 55,
				processed_bytes_total: 1000,
				total_errors: 2,
			};
			const out = normalize_metric_names(legacy, 'inference-gateway');
			expect(out.loxilb_lb_rules).toBe(4);
			expect(out.loxilb_active_conntrack_entries).toBe(12);
			expect(out.loxilb_healthy_endpoints).toBe(3);
			expect(out.loxilb_system_cpu_utilization_percent).toBe(55);
			expect(out.loxilb_processed_bytes_total).toBe(1000);
			expect(out.loxilb_errors_total).toBe(2);
		});

		it('prefers the canonical name when both are present and never overwrites it', () => {
			const mixed = {loxilb_lb_rules: 9, lb_rule_count: 4};
			expect(normalize_metric_names(mixed, 'inference-gateway').loxilb_lb_rules).toBe(9);
		});

		it('leaves canonical-only input (post-rename gateway) untouched', () => {
			const modern = {loxilb_active_conntrack_entries: 7, loxilb_conntrack_max_entries: 524288};
			const out = normalize_metric_names(modern, 'inference-gateway');
			expect(out.loxilb_active_conntrack_entries).toBe(7);
			expect(out.loxilb_conntrack_max_entries).toBe(524288);
			// No legacy source → no phantom zero for a metric that simply isn't present.
			expect(out.loxilb_new_flows).toBeUndefined();
		});

		it('does not fabricate a value when neither name is present', () => {
			expect(normalize_metric_names({}, 'inference-gateway').loxilb_lb_rules).toBeUndefined();
		});
	});

	// ---- upstream loxilb ----
	// Names below are the live v0.9.8-dev scrape: endpoint health is counted per
	// host, the cumulative counters carry no `_total`, and no system utilization
	// series exists at all.
	const LOXILB_SCRAPE = {
		active_conntrack_count: 92,
		active_flow_count_tcp: 92,
		new_flow_count: 36,
		lb_rule_count: 4,
		healthy_host_count: 3,
		unhealthy_host_count: 0,
		processed_bytes: 2_604_644,
		processed_packets: 43_412,
		total_errors: 0,
		total_requests: 86_690,
	};

	describe('loxilb flavor', () => {
		it('reads upstream host-count endpoint health', () => {
			const out = normalize_metric_names({...LOXILB_SCRAPE}, 'loxilb');
			expect(out.loxilb_healthy_endpoints).toBe(3);
			expect(out.loxilb_unhealthy_endpoints).toBe(0);
		});

		it('reads the suffix-less cumulative counters that drive the rate cards', () => {
			const out = normalize_metric_names({...LOXILB_SCRAPE}, 'loxilb');
			expect(out.loxilb_processed_bytes_total).toBe(2_604_644);
			expect(out.loxilb_processed_packets_total).toBe(43_412);
			expect(out.loxilb_errors_total).toBe(0);
		});

		it('reads the conntrack/flow/lb names it shares with the pre-rename gateway', () => {
			const out = normalize_metric_names({...LOXILB_SCRAPE}, 'loxilb');
			expect(out.loxilb_active_conntrack_entries).toBe(92);
			expect(out.loxilb_active_flow_count_tcp).toBe(92);
			expect(out.loxilb_new_flows).toBe(36);
			expect(out.loxilb_lb_rules).toBe(4);
		});

		it('leaves system utilization absent rather than zero (upstream exports none)', () => {
			const out = normalize_metric_names({...LOXILB_SCRAPE}, 'loxilb');
			// Absence is what makes SystemUsageCard render N/A instead of "0% used".
			expect(out.loxilb_system_cpu_utilization_percent).toBeUndefined();
			expect(out.loxilb_system_memory_utilization_percent).toBeUndefined();
			expect(out.loxilb_system_disk_utilization_percent).toBeUndefined();
			expect(out.loxilb_conntrack_max_entries).toBeUndefined();
		});
	});

	// ---- the point of keeping the tables separate ----
	it('does not read loxilb names under the gateway table, or vice versa', () => {
		const asGateway = normalize_metric_names({...LOXILB_SCRAPE}, 'inference-gateway');
		expect(asGateway.loxilb_healthy_endpoints).toBeUndefined();
		expect(asGateway.loxilb_processed_bytes_total).toBeUndefined();

		const gatewayScrape = {healthy_endpoints_count: 5, processed_bytes_total: 77, system_cpu_utilization: 12};
		const asLoxilb = normalize_metric_names({...gatewayScrape}, 'loxilb');
		expect(asLoxilb.loxilb_healthy_endpoints).toBeUndefined();
		expect(asLoxilb.loxilb_processed_bytes_total).toBeUndefined();
		expect(asLoxilb.loxilb_system_cpu_utilization_percent).toBeUndefined();
	});
});
