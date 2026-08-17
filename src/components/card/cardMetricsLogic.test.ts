import {describe, expect, it} from 'vitest';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import {derive_connection_flows, derive_endpoint_health, is_reporting} from './cardMetricsLogic';

//---------------------------------------------------------
// The rule under test: an absent metric is not a zero.
//---------------------------------------------------------
// Every assertion below is `toBeUndefined()` where the pre-fix code returned 0.
// They look trivial; they are the entire point. A backend omits a family it
// could not sample so the UI can say "not reported" — the moment a `?? 0` slips
// back in, the UI starts stating a number nobody measured, and nothing else in
// the suite notices.

const snapshot = (critical: ITypedLiveMetricsResponse['critical'], available = true): ITypedLiveMetricsResponse => ({
	timestamp: 0,
	critical,
	total_metrics: Object.keys(critical).length,
	available,
});

describe('is_reporting', () => {
	it('is false before any snapshot arrives', () => {
		expect(is_reporting(undefined)).toBe(false);
	});

	it('is false for an unavailable snapshot even though it has a critical map', () => {
		expect(is_reporting(snapshot({}, false))).toBe(false);
	});

	it('is true for a live instance whose counters are all zero', () => {
		expect(is_reporting(snapshot({loxilb_lb_rules: 0}, true))).toBe(true);
	});
});

describe('derive_connection_flows', () => {
	it('reports every figure as unknown when collection is disabled', () => {
		const out = derive_connection_flows(snapshot({}, false));
		expect(out.totalTracked).toBeUndefined();
		expect(out.totalActive).toBeUndefined();
		expect(out.tcp).toBeUndefined();
		expect(out.newFlows).toBeUndefined();
		expect(out.utilizationPct).toBeUndefined();
	});

	it('keeps a real zero as zero', () => {
		// The counterpart of the case above, and the reason `available` exists:
		// an idle instance must NOT read as "not reported".
		const out = derive_connection_flows(
			snapshot({loxilb_active_conntrack_entries: 0, loxilb_active_flow_count_tcp: 0, loxilb_new_flows: 0}),
		);
		expect(out.totalTracked).toBe(0);
		expect(out.totalActive).toBe(0);
		expect(out.newFlows).toBe(0);
	});

	it('sums only the protocols the instance actually reported', () => {
		const out = derive_connection_flows(snapshot({loxilb_active_flow_count_tcp: 7, loxilb_active_flow_count_udp: 3}));
		expect(out.totalActive).toBe(10);
		expect(out.sctp, 'an unreported protocol stays absent rather than padding the total with 0').toBeUndefined();
	});

	it('leaves the active total unknown when no protocol is reported at all', () => {
		const out = derive_connection_flows(snapshot({loxilb_lb_rules: 4}));
		expect(out.totalActive).toBeUndefined();
	});

	it('hides conntrack utilization when the instance publishes no capacity', () => {
		// A pre-parity loxilb exports no loxilb_conntrack_max_entries. The old
		// `|| 0` made the divisor 0; the ratio must simply not be derived.
		const out = derive_connection_flows(snapshot({loxilb_active_conntrack_entries: 92}));
		expect(out.utilizationPct).toBeUndefined();
	});

	it('derives conntrack utilization on a parity build that publishes capacity', () => {
		const out = derive_connection_flows(snapshot({loxilb_active_conntrack_entries: 32_768, loxilb_conntrack_max_entries: 65_536}));
		expect(out.utilizationPct).toBe(50);
	});

	it('does not divide by a zero capacity', () => {
		const out = derive_connection_flows(snapshot({loxilb_active_conntrack_entries: 5, loxilb_conntrack_max_entries: 0}));
		expect(out.utilizationPct).toBeUndefined();
	});
});

describe('derive_endpoint_health', () => {
	it('says unknown — not "no endpoints" — when collection is disabled', () => {
		// The specific regression this guards: reading both counts as `|| 0` gave
		// total === 0, which the card announced as "0% / No Endpoints" on any
		// instance with Prometheus turned off. A definite claim from no data.
		const out = derive_endpoint_health(snapshot({}, false));
		expect(out.status).toBe('unknown');
		expect(out.total).toBeUndefined();
		expect(out.healthPercentage).toBeUndefined();
	});

	it('says unknown when the snapshot is available but carries neither endpoint metric', () => {
		const out = derive_endpoint_health(snapshot({loxilb_lb_rules: 4}));
		expect(out.status).toBe('unknown');
		expect(out.healthy).toBeUndefined();
	});

	it('distinguishes a genuine "no endpoints configured" from unknown', () => {
		const out = derive_endpoint_health(snapshot({loxilb_healthy_endpoints: 0, loxilb_unhealthy_endpoints: 0}));
		expect(out.status).toBe('no-endpoints');
		expect(out.total).toBe(0);
	});

	it('grades a fully healthy fleet', () => {
		const out = derive_endpoint_health(snapshot({loxilb_healthy_endpoints: 3, loxilb_unhealthy_endpoints: 0}));
		expect(out.status).toBe('excellent');
		expect(out.healthPercentage).toBe(100);
	});

	it('grades a degraded fleet', () => {
		const out = derive_endpoint_health(snapshot({loxilb_healthy_endpoints: 1, loxilb_unhealthy_endpoints: 3}));
		expect(out.status).toBe('critical');
		expect(out.healthPercentage).toBe(25);
	});

	it('still derives a total when only one side is reported', () => {
		const out = derive_endpoint_health(snapshot({loxilb_healthy_endpoints: 2}));
		expect(out.total).toBe(2);
		expect(out.status).toBe('excellent');
		expect(out.unhealthy, 'the unreported side stays absent').toBeUndefined();
	});
});
