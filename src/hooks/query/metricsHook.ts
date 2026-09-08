//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor} from 'api/capabilities';
import {project_live_metrics} from 'connector/instance/metrics';
import {OpResult} from 'connector/fetcher/opResult';
import {useMemo} from 'react';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import {IInstance} from 'types/oam';
import {useMetricsSnapshot} from './observabilityHooks';

//---------------------------------------------------------
// Live metrics for a dashboard card (UI-MON-006 compatibility surface)
//---------------------------------------------------------
// Every metrics card needs the same two things: the instance's flavor (a
// Prometheus scrape can only be read under the naming table of the backend
// that produced it) and a polled snapshot. Both live here so a card cannot
// forget the flavor and silently read the wrong series.
//
// Since the shared-snapshot migration, this hook is a PROJECTION over the
// one `useMetricsSnapshot` query: cards no longer create their own network
// polls. `keyPrefix`/`refetchInterval`/`extraKey` are accepted for source
// compatibility but no longer influence the network cadence — that is the
// shared 10-second product decision. Five cards on screen previously
// meant five overlapping GET loops (one per second at the worst); now they
// all read the same 10-second observation, so their numbers agree by
// construction.
export interface ILiveMetricsOptions {
	/** @deprecated cards share one snapshot query; the prefix no longer keys a network poll. */
	keyPrefix: string;
	/** @deprecated network cadence is the shared METRICS_SNAPSHOT_CADENCE_MS. */
	refetchInterval: number;
	/** @deprecated no per-card query entry exists to key. */
	extraKey?: string | number;
}

export function useLiveMetrics(
	instance: IInstance | null,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- accepted for source compatibility with the per-card call sites; cadence/keying is the shared snapshot's
	_options: ILiveMetricsOptions
): {
	metrics: ITypedLiveMetricsResponse | undefined;
	isLoading: boolean;
	flavor: InstanceFlavor | undefined;
	/**
	 * Why the last scrape produced no exposition, when that is knowable.
	 * Undefined means the scrape succeeded — including a healthy
	 * instance whose counters read zero. A card must branch on this BEFORE
	 * falling back to "not reported by this instance": a refused scrape (401)
	 * and collection being switched off (503) are not the instance choosing
	 * not to publish a metric, and saying so blames the wrong thing.
	 */
	failure: OpResult | undefined;
	refetch: () => void;
} {
	const {snapshot, isLoading, flavor, refetch} = useMetricsSnapshot(instance);

	// Fail-narrow like the capability surface: project under the loxilb naming
	// table while unresolved. Harmless — diverging names resolve to absent,
	// and the snapshot query key carries the flavor, so late resolution swaps
	// to a fresh cache entry without a reload.
	const effective: InstanceFlavor = flavor ?? 'loxilb';

	const metrics = useMemo(
		() => (snapshot ? (project_live_metrics(snapshot, effective) as ITypedLiveMetricsResponse) : undefined),
		[snapshot, effective],
	);

	return {
		metrics,
		isLoading,
		flavor,
		failure: metrics?.failure,
		refetch,
	};
}
