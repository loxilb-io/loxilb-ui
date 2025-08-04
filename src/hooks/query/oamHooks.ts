//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQueries} from '@tanstack/react-query';
import {query_get_ha_state_all} from 'connector/instance/status';
import {query_get_alerts_history} from 'connector/oam/alerts';
import {query_get_instance_list, query_get_log_archives, query_get_me, query_get_oam_logs} from 'connector/oam/oam';
import {useCallback, useMemo} from 'react';
import {useQueryOAMData} from './common';

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function useAlertsHistory() {
	return useQueryOAMData(['alerts_history'], query_get_alerts_history);
}

export function useOAMLogs() {
	return useQueryOAMData(['logs'], query_get_oam_logs);
}

export function useOAMLogArchives() {
	return useQueryOAMData(['log_archives'], query_get_log_archives);
}

export function useInstances() {
	const {data: instance_list = [], refetch} = useQueryOAMData(['instance_list'], query_get_instance_list);

	const get_instance = useCallback((id: number) => instance_list.find(item => item.id === id), [instance_list]);
	const get_instance_name = useCallback((id: number) => instance_list.find(item => item.id === id)?.name || 'INVALID INSTANCE', [instance_list]);

	return {get_instance, get_instance_name, instance_list, refetch};
}

export function useInstanceWithHA() {
	const {instance_list} = useInstances();

	const queries = useMemo(
		() =>
			instance_list.map(instance => ({
				queryKey: ['ha_state', instance.name],
				queryFn: () => query_get_ha_state_all(instance),
				enabled: !!instance.name,
				refetchOnReconnect: true,
				staleTime: 5000,
			})),
		[instance_list],
	);

	const haQueries = useQueries({queries});
	const queryData = useMemo(() => haQueries.map(query => query.data), [haQueries.map(q => q.data).join(',')]);

	const instance_set = useMemo(() => {
		return instance_list.map((instance, idx) => {
			const ha = queryData[idx]?.at(0) ?? null;
			return {instance, ha};
		});
	}, [instance_list, queryData]);

	return {instance_set};
}

export function useMyInfo() {
	const {data: my_info} = useQueryOAMData(['my_info'], query_get_me);
	return my_info;
}
