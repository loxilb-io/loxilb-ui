//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {InstanceFlavor} from 'api/capabilities';
import {query_get_live_metrics} from 'connector/instance/metrics';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import {IInstance} from 'types/oam';
import {useInstanceFlavor} from './flavorHook';

//---------------------------------------------------------
// Live metrics for a dashboard card
//---------------------------------------------------------
// Every metrics card needs the same two things: the instance's flavor (a
// Prometheus scrape can only be read under the naming table of the backend
// that produced it) and a polled snapshot. Both live here so a card cannot
// forget the flavor and silently read the wrong series — the defect that made
// endpoint-health and the traffic/packet rate cards go blank on upstream
// loxilb.
//
// The flavor is part of the query key: while the /version probe is in flight
// the helpers answer as the gateway (the codebase-wide convention, see
// flavorHook), and resolving to loxilb swaps to a fresh cache entry rather
// than reinterpreting samples already taken. Nothing is contaminated by the
// interim guess because the two tables share no divergent names — under the
// wrong table the diverging metrics simply resolve to absent.
export interface ILiveMetricsOptions {
	// Distinct per card so cards with different poll rates don't share an entry.
	keyPrefix: string;
	refetchInterval: number;
	// Extra query-key segment for cards parameterized by metric (CriticalMetricCard).
	extraKey?: string | number;
}

export function useLiveMetrics(
	instance: IInstance | null,
	options: ILiveMetricsOptions
): {metrics: ITypedLiveMetricsResponse | undefined; isLoading: boolean; flavor: InstanceFlavor | undefined} {
	const {keyPrefix, refetchInterval, extraKey} = options;
	const {flavor} = useInstanceFlavor(instance);
	const effective: InstanceFlavor = flavor ?? 'inference-gateway';

	const query = useQuery({
		queryKey: [keyPrefix, instance?.id, effective, ...(extraKey === undefined ? [] : [extraKey])],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, effective);
		},
		enabled: !!instance,
		refetchInterval,
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});

	return {metrics: query.data as ITypedLiveMetricsResponse | undefined, isLoading: query.isLoading, flavor};
}
