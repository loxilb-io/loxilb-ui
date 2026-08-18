import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';
import {normalize_metric_names, parse_prometheus_text, query_get_live_metrics} from './metrics';

vi.mock('../fetcher/fetcher_inst', () => ({GET_INST_TEXT: vi.fn()}));

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

	it('handles NEGATIVE exponents', () => {
		// Regression: the old value pattern had no `-` inside the exponent, so
		// `7.9598e-05` captured as `7.9598e` -> NaN -> silently dropped. Seen live
		// in go_gc_duration_seconds; any small ratio metric would hit it too.
		const text = ['go_gc_duration_seconds{quantile="0"} 7.9598e-05', 'ratio 1.25E-3', 'tiny .5e-2'].join('\n');
		expect(parse_prometheus_text(text)).toEqual({
			go_gc_duration_seconds: 7.9598e-5,
			ratio: 1.25e-3,
			tiny: 0.005,
		});
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

		it('leaves system utilization absent rather than zero (pre-parity build exports none)', () => {
			const out = normalize_metric_names({...LOXILB_SCRAPE}, 'loxilb');
			// Absence is what makes SystemUsageCard render N/A instead of "0% used".
			expect(out.loxilb_system_cpu_utilization_percent).toBeUndefined();
			expect(out.loxilb_system_memory_utilization_percent).toBeUndefined();
			expect(out.loxilb_system_disk_utilization_percent).toBeUndefined();
			expect(out.loxilb_conntrack_max_entries).toBeUndefined();
		});
	});

	// A loxilb-oss build with the metrics-parity change publishes every canonical
	// name natively, dual-emitted alongside the legacy ones. The alias table must
	// be inert against it: canonical-first resolution means nothing is rewritten,
	// and the legacy twins carry identical values so a mistaken overwrite would
	// be invisible here — hence the distinct values in the fixture below.
	describe('loxilb flavor, metrics-parity build', () => {
		// Legacy twins deliberately given DIFFERENT values than their canonical
		// counterparts. A real instance emits them equal; making them differ is
		// what proves the canonical value is the one that survives.
		const PARITY_SCRAPE = {
			// canonical (what the parity build publishes)
			loxilb_active_conntrack_entries: 92,
			loxilb_active_flow_count_tcp: 92,
			loxilb_new_flows: 36,
			loxilb_lb_rules: 4,
			loxilb_healthy_endpoints: 3,
			loxilb_unhealthy_endpoints: 0,
			loxilb_processed_bytes_total: 2_604_644,
			loxilb_processed_packets_total: 43_412,
			loxilb_errors_total: 0,
			// canonical-only families, impossible before the parity build
			loxilb_conntrack_max_entries: 65_536,
			loxilb_system_cpu_utilization_percent: 12.5,
			loxilb_system_memory_utilization_percent: 40,
			loxilb_system_disk_utilization_percent: 73.9,
			// legacy twins, still emitted and tagged DEPRECATED in HELP
			active_conntrack_count: -1,
			healthy_host_count: -1,
			processed_bytes: -1,
			lb_rule_count: -1,
		};

		it('passes canonical names through untouched when legacy twins disagree', () => {
			const out = normalize_metric_names({...PARITY_SCRAPE}, 'loxilb');
			expect(out.loxilb_active_conntrack_entries).toBe(92);
			expect(out.loxilb_healthy_endpoints).toBe(3);
			expect(out.loxilb_processed_bytes_total).toBe(2_604_644);
			expect(out.loxilb_lb_rules).toBe(4);
		});

		it('surfaces the families that only the parity build can report', () => {
			const out = normalize_metric_names({...PARITY_SCRAPE}, 'loxilb');
			expect(out.loxilb_conntrack_max_entries).toBe(65_536);
			expect(out.loxilb_system_cpu_utilization_percent).toBe(12.5);
			expect(out.loxilb_system_memory_utilization_percent).toBe(40);
			expect(out.loxilb_system_disk_utilization_percent).toBe(73.9);
		});

		it('covers every canonical key the dashboard reads', () => {
			const out = normalize_metric_names({...PARITY_SCRAPE}, 'loxilb');
			// Keep in step with the keys consumed by the dashboard cards. A key
			// added to a card without a source here is a card that renders N/A.
			for (const key of [
				'loxilb_lb_rules',
				'loxilb_processed_bytes_total',
				'loxilb_processed_packets_total',
				'loxilb_healthy_endpoints',
				'loxilb_unhealthy_endpoints',
				'loxilb_active_conntrack_entries',
				'loxilb_conntrack_max_entries',
				'loxilb_active_flow_count_tcp',
				'loxilb_new_flows',
				'loxilb_errors_total',
				'loxilb_system_cpu_utilization_percent',
				'loxilb_system_memory_utilization_percent',
				'loxilb_system_disk_utilization_percent',
			]) {
				expect(out[key], `${key} must resolve on a parity build`).toBeDefined();
			}
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

//---------------------------------------------------------
// query_get_live_metrics — "we don't know" vs "it is zero"
//---------------------------------------------------------
// The Prometheus surface sits OUTSIDE the swagger contract, so neither the
// generated capability map nor the subset test can police these response
// shapes. Fixtures are the only guard, which is why all three shapes a real
// deployment can produce are pinned here.
describe('query_get_live_metrics availability', () => {
	const instance = {id: 14, name: 'loxilb-oss'} as IInstance;
	const mocked = vi.mocked(GET_INST_TEXT);

	const respond = (code: number, data: string | null) => {
		mocked.mockResolvedValue({code, data, message: ''});
	};

	beforeEach(() => {
		mocked.mockReset();
	});

	it('reports unavailable on a 503 (collection disabled — both flavors)', async () => {
		respond(503, 'Prometheus option is disabled.');
		const snap = await query_get_live_metrics(instance, 'loxilb');
		expect(snap.available).toBe(false);
		expect(snap.total_metrics).toBe(0);
		expect(snap.critical).toEqual({});
	});

	it('reports unavailable on a pre-parity loxilb 200 carrying a JSON string', async () => {
		// The shape a *released* loxilb-oss still answers with. It is a 200, so
		// nothing but the body content can give it away.
		respond(200, '"Prometheus option is disabled."');
		const snap = await query_get_live_metrics(instance, 'loxilb');
		expect(snap.available).toBe(false);
		expect(snap.total_metrics).toBe(0);
	});

	it('does not depend on the wording of the disabled message', async () => {
		// Detection is by content — no parseable sample — not by matching the
		// sentence. A reworded release must not read as a live instance.
		respond(200, '"Metrics collection is turned off, see --prometheus."');
		expect((await query_get_live_metrics(instance, 'loxilb')).available).toBe(false);
	});

	it('reports unavailable when the scrape is refused (401 under --userservice)', async () => {
		respond(401, null);
		expect((await query_get_live_metrics(instance, 'loxilb')).available).toBe(false);
	});

	it('reports AVAILABLE for a live instance whose counters are genuinely all zero', async () => {
		// The case `available` exists for. This snapshot is byte-identical to a
		// disabled one under any total_metrics-based test, so if this ever
		// regresses to false, an idle instance starts rendering N/A everywhere.
		respond(200, ['# HELP lb_rule_count Number of LB rules', '# TYPE lb_rule_count gauge', 'lb_rule_count 0', 'active_conntrack_count 0', 'processed_bytes 0'].join('\n'));
		const snap = await query_get_live_metrics(instance, 'loxilb');
		expect(snap.available).toBe(true);
		expect(snap.critical.loxilb_lb_rules).toBe(0);
		expect(snap.critical.loxilb_processed_bytes_total).toBe(0);
	});

	it('reports available and normalizes under the flavor table on a parity build', async () => {
		respond(
			200,
			[
				'# HELP loxilb_lb_rules Number of LB rules',
				'loxilb_lb_rules 4',
				'# HELP active_conntrack_count DEPRECATED: use loxilb_active_conntrack_entries.',
				'active_conntrack_count 15',
				'loxilb_active_conntrack_entries 15',
				'loxilb_system_disk_utilization_percent 73.9',
			].join('\n'),
		);
		const snap = await query_get_live_metrics(instance, 'loxilb');
		expect(snap.available).toBe(true);
		expect(snap.critical.loxilb_lb_rules).toBe(4);
		expect(snap.critical.loxilb_active_conntrack_entries).toBe(15);
		expect(snap.critical.loxilb_system_disk_utilization_percent).toBe(73.9);
	});

	it('reads a gateway scrape under the gateway table', async () => {
		respond(200, ['healthy_endpoints_count 3', 'system_cpu_utilization 12.5'].join('\n'));
		const snap = await query_get_live_metrics(instance, 'inference-gateway');
		expect(snap.available).toBe(true);
		expect(snap.critical.loxilb_healthy_endpoints).toBe(3);
		expect(snap.critical.loxilb_system_cpu_utilization_percent).toBe(12.5);
	});
});
