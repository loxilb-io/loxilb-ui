//---------------------------------------------------------
// Pure derivations behind the live-metric cards.
//---------------------------------------------------------
// Extracted from the card components so the one rule that matters here is
// testable without a renderer: **an absent metric must stay absent**.
//
// The backends omit a family they cannot sample rather than exporting a literal
// 0, specifically so a consumer can tell "not collected" from "nothing is
// happening" (docs/internal/METRICS_LOXILB_PARITY.md §2.4). Every `?? 0` on the
// way to the screen throws that away and replaces it with a confident false
// statement. These functions preserve `undefined`; the cards render it as N/A.
import {ITypedLiveMetricsResponse} from 'types/metrics';

type Snapshot = ITypedLiveMetricsResponse | undefined;

/**
 * True when the instance actually served an exposition for this snapshot.
 * A snapshot that never arrived, or one the instance refused/disabled, tells us
 * nothing — which is not the same as telling us zero.
 */
export function is_reporting(metrics: Snapshot): boolean {
	return metrics?.critical !== undefined && metrics.available;
}

export interface IConnectionFlowFigures {
	totalActive: number | undefined;
	totalTracked: number | undefined;
	tcp: number | undefined;
	udp: number | undefined;
	sctp: number | undefined;
	newFlows: number | undefined;
	utilizationPct: number | undefined;
}

const NO_FLOWS: IConnectionFlowFigures = {
	totalActive: undefined,
	totalTracked: undefined,
	tcp: undefined,
	udp: undefined,
	sctp: undefined,
	newFlows: undefined,
	utilizationPct: undefined,
};

export function derive_connection_flows(metrics: Snapshot): IConnectionFlowFigures {
	if (!is_reporting(metrics)) return NO_FLOWS;
	const c = metrics!.critical;

	const tcp = c.loxilb_active_flow_count_tcp;
	const udp = c.loxilb_active_flow_count_udp;
	const sctp = c.loxilb_active_flow_count_sctp;

	// Sum only the protocols actually reported. If none are, the total is
	// unknown rather than 0. A backend reporting TCP but not SCTP still gives a
	// real partial total — imperfect, but substituting 0 for the missing
	// protocol would understate it while looking exact.
	const reportedFlows = [tcp, udp, sctp].filter((v): v is number => v !== undefined);
	const totalActive = reportedFlows.length > 0 ? reportedFlows.reduce((a, b) => a + b, 0) : undefined;

	const totalTracked = c.loxilb_active_conntrack_entries;

	// Conntrack utilization needs BOTH a capacity and a current count. A
	// pre-parity loxilb publishes no `loxilb_conntrack_max_entries` at all, so
	// the ratio is underivable and the view stays hidden — never divided by a
	// fabricated zero.
	const maxTracked = c.loxilb_conntrack_max_entries;
	const utilizationPct =
		maxTracked !== undefined && maxTracked > 0 && totalTracked !== undefined ? Math.round((totalTracked / maxTracked) * 100) : undefined;

	return {totalActive, totalTracked, tcp, udp, sctp, newFlows: c.loxilb_new_flows, utilizationPct};
}

export type EndpointHealthStatus = 'excellent' | 'good' | 'warning' | 'critical' | 'no-endpoints' | 'unknown';

export interface IEndpointHealthFigures {
	healthy: number | undefined;
	unhealthy: number | undefined;
	total: number | undefined;
	healthPercentage: number | undefined;
	status: EndpointHealthStatus;
}

const UNKNOWN_HEALTH: IEndpointHealthFigures = {
	healthy: undefined,
	unhealthy: undefined,
	total: undefined,
	healthPercentage: undefined,
	status: 'unknown',
};

export function derive_endpoint_health(metrics: Snapshot): IEndpointHealthFigures {
	// Not knowing the endpoint counts is NOT knowing there are none. Reading
	// both metrics as `|| 0` used to produce total === 0, which the card then
	// announced as "0% — No Endpoints": a definite claim about a fleet it had
	// been told nothing about.
	if (!is_reporting(metrics)) return UNKNOWN_HEALTH;

	const healthy = metrics!.critical.loxilb_healthy_endpoints;
	const unhealthy = metrics!.critical.loxilb_unhealthy_endpoints;
	if (healthy === undefined && unhealthy === undefined) return UNKNOWN_HEALTH;

	// One side reported and the other not still yields a real total; only a
	// complete absence is unknown.
	const total = (healthy ?? 0) + (unhealthy ?? 0);
	const healthPercentage = total > 0 ? ((healthy ?? 0) / total) * 100 : 0;

	let status: EndpointHealthStatus = 'unknown';
	if (total === 0) status = 'no-endpoints';
	else if (healthPercentage === 100) status = 'excellent';
	else if (healthPercentage >= 80) status = 'good';
	else if (healthPercentage >= 50) status = 'warning';
	else status = 'critical';

	return {healthy, unhealthy, total, healthPercentage: Math.round(healthPercentage), status};
}
