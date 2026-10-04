//---------------------------------------------------------
// Snapshot list + schedule query hooks (docs/SNAPSHOT_UI_DESIGN.md §6).
//
// No background polling: the list only changes through user actions and the
// OAM scheduler — the page's Refresh button covers the latter. Mutations on
// the page invalidate both keys.
//---------------------------------------------------------
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {query_get_snapshot_schedule, query_get_snapshots} from 'connector/oam/snapshotApi';
import {useCallback} from 'react';

export const snapshotsQueryKey = (instanceId: number, page: number) => ['oam', 'snapshots', instanceId, page];
export const snapshotScheduleQueryKey = (instanceId: number) => ['oam', 'snapshot-schedule', instanceId];

export function useSnapshots(instanceId: number | undefined, page: number, limit: number) {
	return useQuery({
		queryKey: snapshotsQueryKey(instanceId ?? -1, page),
		queryFn: () => query_get_snapshots(instanceId!, {page, limit}),
		enabled: instanceId !== undefined,
		retry: (failureCount, error) => (error as any).status !== 404 && failureCount < 3,
		retryDelay: 3000,
		staleTime: 5000,
	});
}

export function useSnapshotSchedule(instanceId: number | undefined) {
	return useQuery({
		queryKey: snapshotScheduleQueryKey(instanceId ?? -1),
		queryFn: () => query_get_snapshot_schedule(instanceId!),
		enabled: instanceId !== undefined,
		retry: (failureCount, error) => (error as any).status !== 404 && failureCount < 3,
		retryDelay: 3000,
		staleTime: 5000,
	});
}

// Invalidates every snapshot query of one instance (all pages + schedule).
// Call after any mutation — including a failed restore commit, which still
// creates a pre_restore row.
//
// Cancels first: while a query has no data yet, React Query answers an
// invalidate with the fetch already in flight, which was issued before the
// mutation — a snapshot taken during the page's first load would never show.
export function useInvalidateSnapshots(instanceId: number | undefined) {
	const queryClient = useQueryClient();
	return useCallback(async () => {
		if (instanceId === undefined) return;
		const keys = [['oam', 'snapshots', instanceId], snapshotScheduleQueryKey(instanceId)];
		await Promise.all(keys.map(queryKey => queryClient.cancelQueries({queryKey})));
		await Promise.all(keys.map(queryKey => queryClient.invalidateQueries({queryKey})));
	}, [queryClient, instanceId]);
}
