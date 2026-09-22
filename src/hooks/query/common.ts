//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {get_local_storage, remove_local_storage, save_local_storage} from 'common';
import {useEffect, useState} from 'react';
import {ITimeSeriesPoint} from 'types/global';
import {IInstance} from 'types/oam';

export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_DATA_POINTS = 100; // Limit number of data points to prevent storage overflow
const POLLING_INTERVAL_MS = parseInt(process.env.REACT_APP_REPATCH_INTERVAL || '1000');

//---------------------------------------------------------
// Internal Helper Functions
//---------------------------------------------------------
function pruneOld<T>(arr: ITimeSeriesPoint<T>[]): ITimeSeriesPoint<T>[] {
	const now = Date.now();
	const timeFiltered = arr.filter(item => now - item.timestamp <= MAX_DURATION_MS);
	
	// Also limit by max data points to prevent storage overflow
	if (timeFiltered.length > MAX_DATA_POINTS) {
		return timeFiltered.slice(-MAX_DATA_POINTS);
	}
	
	return timeFiltered;
}

/**
 * Read a persisted series, or `[]` when what is stored cannot be trusted.
 *
 * ⚠️ localStorage is durable, origin-wide and survives upgrades, so what comes
 * back is not necessarily what THIS build wrote: an older shape, a key left
 * half-cleaned by `clearOldTimeSeriesData`, or a hand-edited value all arrive
 * here. Both callers run on the render path — the `useState` initializer
 * literally during render — so a throw unmounts the page instead of degrading
 * it. That is the same failure class as the persisted metrics snapshot that
 * crashed the observability pages, and the same reason
 * `DashboardPage.readStoredLayout` guards its own parse. This path did not,
 * and `pruneOld` additionally assumed an array, so a stored `{}` answered
 * `filter is not a function`.
 *
 * Bad data is DROPPED rather than kept: keeping it means meeting it again on
 * the next mount, and a series re-accumulates from polling within seconds.
 */
export function readStoredSeries<T>(storageKey: string): ITimeSeriesPoint<T>[] {
	const rawJson = get_local_storage(storageKey);
	if (!rawJson) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawJson);
	} catch {
		remove_local_storage(storageKey);
		return [];
	}

	if (!Array.isArray(parsed)) {
		remove_local_storage(storageKey);
		return [];
	}

	// Drop individual malformed points rather than the whole series: a string
	// timestamp coerces cleanly through pruneOld's arithmetic and would survive
	// as a real point, carrying an unusable `data` to every chart downstream.
	const points = parsed.filter(
		(p): p is ITimeSeriesPoint<T> =>
			!!p && typeof p === 'object' && typeof (p as {timestamp?: unknown}).timestamp === 'number',
	);
	return pruneOld(points);
}

function appendSeries<T>(prev: ITimeSeriesPoint<T>[], newPoint: {timestamp: number; data: T}): ITimeSeriesPoint<T>[] {
	const combined = [...prev, {timestamp: newPoint.timestamp, data: newPoint.data}];
	return pruneOld(combined);
}

//---------------------------------------------------------
// Generic Time Series Hook Generator
//---------------------------------------------------------
export function createTimeSeriesHook<TRaw, TWrapped extends {}>(
	seriesKey: string,
	metricsKey: string,
	fetcher: (instance: IInstance) => Promise<TRaw>,
	wrapData: (raw: TRaw) => TWrapped,
) {
	return function useGenericSeries(instance: IInstance | null) {
		const queryClient = useQueryClient();
		const storageKey = instance ? `${seriesKey}_${instance.id}` : null;

		const [seriesData, setSeriesData] = useState<ITimeSeriesPoint<TWrapped>[]>(() => {
			if (!instance || !storageKey) return [];

			const cached = queryClient.getQueryData<ITimeSeriesPoint<TWrapped>[]>(['series', storageKey]);
			if (cached && cached.length > 0) return pruneOld(cached);

			return readStoredSeries<TWrapped>(storageKey);
		});

		const fetchQuery = useQuery<TRaw>({
			queryKey: instance ? [metricsKey, instance.id] : [],
			queryFn: () => fetcher(instance!),
			enabled: !!instance,
			refetchInterval: POLLING_INTERVAL_MS,
			staleTime: 0,
		});

		useEffect(() => {
			if (fetchQuery.data === undefined || !instance || !storageKey) return;

			const wrapped = wrapData(fetchQuery.data);

			setSeriesData(prevSeries => {
				const nextSeries = appendSeries(prevSeries, {timestamp: Date.now(), data: wrapped});

				setTimeout(() => {
					queryClient.setQueryData(['series', storageKey], nextSeries);
					save_local_storage(storageKey, JSON.stringify(nextSeries));
				}, 0);

				return nextSeries;
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
		}, [fetchQuery.dataUpdatedAt, instance?.id, storageKey, queryClient]);

		useEffect(() => {
			if (!instance || !storageKey) {
				setSeriesData([]);
				return;
			}

			const cached = queryClient.getQueryData<ITimeSeriesPoint<TWrapped>[]>(['series', storageKey]);
			if (cached && cached.length > 0) {
				setSeriesData(pruneOld(cached));
				return;
			}

			setSeriesData(readStoredSeries<TWrapped>(storageKey));
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
		}, [instance?.id, storageKey, queryClient]);

		return seriesData;
	};
}

export const useQueryInstanceData = <T>(
	queryKeys: string[],
	queryFn: (instance: IInstance) => Promise<T>,
	instance: IInstance | null,
	is_infinity?: boolean,
	is_common_data?: boolean,
) => {
	const instance_id = instance?.id ? instance.id.toString() : '';
	return useQuery({
		queryKey: is_common_data ? queryKeys : queryKeys.concat(instance_id),
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			else return await queryFn(instance);
		},
		enabled: !!instance,
		retry: (failureCount, error) => (error as any).status !== 404 && failureCount < 3,
		retryDelay: 3000,
		refetchOnMount: is_infinity ? false : true,
		refetchOnWindowFocus: is_infinity ? false : true,
		refetchOnReconnect: true,
		staleTime: is_infinity ? Infinity : 5000,
	});
};

export const useQueryOAMData = <T>(queryKeys: string[], queryFn: () => Promise<T>, is_infinity?: boolean) => {
	return useQuery({
		queryKey: queryKeys,
		queryFn: queryFn,
		retry: (failureCount, error) => (error as any).status !== 404 && failureCount < 3,
		retryDelay: 3000,
		refetchOnMount: is_infinity ? false : true,
		refetchOnWindowFocus: is_infinity ? false : true,
		refetchOnReconnect: is_infinity ? false : true,
		staleTime: is_infinity ? Infinity : 5000,
	});
};
