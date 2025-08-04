//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {get_local_storage, save_local_storage} from 'common';
import {useEffect, useState} from 'react';
import {ITimeSeriesPoint} from 'types/global';
import {IInstance} from 'types/oam';

export const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
export const POLLING_INTERVAL_MS = parseInt(process.env.REACT_APP_REPATCH_INTERVAL || '1000');

//---------------------------------------------------------
// Internal Helper Functions
//---------------------------------------------------------
function pruneOld<T>(arr: ITimeSeriesPoint<T>[]): ITimeSeriesPoint<T>[] {
	const now = Date.now();
	return arr.filter(item => now - item.timestamp <= MAX_DURATION_MS);
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

			const rawJson = get_local_storage(storageKey);
			if (rawJson) {
				const parsed = JSON.parse(rawJson) as ITimeSeriesPoint<TWrapped>[];
				return pruneOld(parsed);
			}

			return [];
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

			const rawJson = get_local_storage(storageKey);
			if (rawJson) {
				const parsed = JSON.parse(rawJson) as ITimeSeriesPoint<TWrapped>[];
				setSeriesData(pruneOld(parsed));
				return;
			}

			setSeriesData([]);
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
