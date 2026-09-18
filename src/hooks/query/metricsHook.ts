//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor} from 'api/capabilities';
import {project_live_metrics} from 'connector/instance/metrics';
import {OpResult} from 'connector/fetcher/opResult';
import {useMemo} from 'react';
import {ObservabilityCadenceMs} from 'preferences';
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
// polls. Five cards on screen previously meant five overlapping GET loops
// (one per second at the worst); now they all read the same observation, so
// their numbers agree by construction.
//
// ⭐⭐ CADENCE FLOWS OUT OF THIS HOOK, NOT INTO IT, and the direction is the
// whole point. This hook used to ACCEPT `{keyPrefix, refetchInterval,
// extraKey}` and ignore all three: five call sites passed 1000 or 10000
// believing they set their own polling, and an eslint-disable sat on the
// unused parameter admitting they did not. The signature was making a promise
// the architecture cannot keep — the snapshot query is SHARED and its interval
// is one global operator preference, so a per-consumer cadence has nowhere to
// live. Honouring the parameter would mean undoing the shared snapshot and
// reinstating the overlapping polls and disagreeing numbers it exists to
// prevent.
//
// So the parameter is gone and `cadenceMs` is returned instead. A consumer
// cannot choose how often the data refreshes, but it can now KNOW — which is
// what the callers actually needed: `RealTimeRateCard` derives rates from
// deltas and must wait whole cadence ticks before it can plot anything, and
// it could not say so while it believed it had asked for one second.

export function useLiveMetrics(instance: IInstance | null): {
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
	/**
	 * The effective network cadence: the operator's preference, not a
	 * constant. Consumers that accumulate samples derive their warm-up and
	 * staleness wording from THIS value — the two differ as soon as a
	 * preference is set, and the options reach 60 s.
	 */
	cadenceMs: ObservabilityCadenceMs;
	refetch: () => void;
} {
	const {snapshot, isLoading, flavor, cadenceMs, refetch} = useMetricsSnapshot(instance);

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
		cadenceMs,
		refetch,
	};
}
