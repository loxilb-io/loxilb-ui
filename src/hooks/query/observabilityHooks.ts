//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {InstanceFlavor} from 'api/capabilities';
import {query_get_metrics_snapshot} from 'connector/instance/observability';
import {useEffect, useRef} from 'react';
import {IMetricsSnapshot} from 'types/observability';
import {IInstance} from 'types/oam';
import {useInstanceFlavor} from './flavorHook';

//---------------------------------------------------------
// Shared metrics snapshot (UI-MON-004)
//---------------------------------------------------------
// ONE network query per instance for the whole observability surface. Panels
// and cards never poll `/metrics` with their own key prefixes or cadences —
// they read this shared snapshot and project through selectors, so every
// Prometheus consumer on screen renders the same `receivedAtMs` observation.
//
// Cadence is the recorded contract-freeze product decision: an honest shared 10-second network
// interval. Derived rates therefore update on 10-second boundaries; a faster
// display tick may smooth presentation but never creates fresher data, and
// nothing here may be described or tested as sub-cadence freshness.
export const METRICS_SNAPSHOT_CADENCE_MS = 10_000;

// Bumped when the snapshot/projection shape changes incompatibly, so a new
// build never reads a structurally older cached entry.
export const SNAPSHOT_PROJECTION_VERSION = 1;

// Retained snapshots per hook consumer — enough for rate derivation and a
// short spark window (6 × 10 s = one minute).
export const SNAPSHOT_RETENTION = 6;

export interface IMetricsSnapshotQuery {
	snapshot: IMetricsSnapshot | undefined;
	// Bounded history of DISTINCT observations, oldest first, current
	// included; rate selectors diff its last two entries. Component-local by
	// design (a ref, not module state): unmount drops it, which keeps the
	// logout purge complete without a registry of accumulators.
	history: readonly IMetricsSnapshot[];
	isLoading: boolean;
	flavor: InstanceFlavor | undefined;
	refetch: () => void;
}

export function useMetricsSnapshot(instance: IInstance | null): IMetricsSnapshotQuery {
	const {flavor} = useInstanceFlavor(instance);
	// Fail-narrow like the capability surface: read under the loxilb naming
	// rules while unresolved. The flavor is part of the query key, so late
	// resolution swaps to a fresh cache entry rather than reinterpreting
	// samples already taken.
	const effective: InstanceFlavor = flavor ?? 'loxilb';

	const query = useQuery({
		queryKey: ['instance', 'metrics-snapshot', instance?.id, effective, SNAPSHOT_PROJECTION_VERSION],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_metrics_snapshot(instance, effective);
		},
		enabled: !!instance,
		refetchInterval: METRICS_SNAPSHOT_CADENCE_MS,
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});

	const snapshot = query.data;

	// Retention ring keyed by instance+flavor: an instance switch or a flavor
	// resolution must never diff counters across two different backends.
	const ringKey = `${instance?.id ?? ''}:${effective}`;
	const ringRef = useRef<{key: string; entries: IMetricsSnapshot[]}>({key: ringKey, entries: []});
	useEffect(() => {
		if (ringRef.current.key !== ringKey) ringRef.current = {key: ringKey, entries: []};
		if (!snapshot) return;
		const entries = ringRef.current.entries;
		// One entry per distinct observation — effect re-runs are not new data.
		if (entries.length > 0 && entries[entries.length - 1].receivedAtMs === snapshot.receivedAtMs) return;
		ringRef.current.entries = [...entries, snapshot].slice(-SNAPSHOT_RETENTION);
	}, [snapshot, ringKey]);

	return {
		snapshot,
		history: ringRef.current.key === ringKey ? ringRef.current.entries : [],
		isLoading: query.isLoading,
		flavor,
		refetch: () => {
			void query.refetch();
		},
	};
}
