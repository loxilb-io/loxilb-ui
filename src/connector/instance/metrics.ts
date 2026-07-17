//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ILiveMetricsResponse} from 'types/metrics';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Live Metrics via Prometheus exposition (gateway: /netlox/v1/metrics)
//---------------------------------------------------------

// Parses Prometheus text format into a flat {metric_name: value} map.
// Labeled samples of the same metric are summed, which matches how the
// dashboard cards consume a flat metric snapshot.
export function parse_prometheus_text(text: string): Record<string, number> {
	const values: Record<string, number> = {};
	for (const line of text.split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(-?[0-9.eE+]+)/);
		if (!match) continue;
		const value = Number(match[3]);
		if (!Number.isFinite(value)) continue;
		values[match[1]] = (values[match[1]] ?? 0) + value;
	}
	return values;
}

/**
 * Get a real-time snapshot of all gateway metrics.
 * The gateway exposes its metric registry in Prometheus text format; metric
 * names are identical to the fields the dashboard cards read (rps_bps,
 * active_conntrack_count, lb_rule_count, system_cpu_utilization, ...).
 */
export async function query_get_live_metrics(instance: IInstance, _phase: 1 | 2 = 2): Promise<ILiveMetricsResponse> {
	const resp = await GET_INST_TEXT(instance, `/metrics`);
	const metrics = typeof resp.data === 'string' ? parse_prometheus_text(resp.data) : {};
	return {
		timestamp: Date.now(),
		critical: metrics,
		important: metrics,
		total_metrics: Object.keys(metrics).length,
	};
}
