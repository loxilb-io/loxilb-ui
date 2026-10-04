//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {move_404} from 'common';
import {query_get_inst_log_archives, query_get_inst_logs} from 'connector/instance/status';
import {useQuery} from '@tanstack/react-query';
import {useLocation} from 'react-router-dom';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export function useInstanceName(): string {
	const location = useLocation();

	const params = new URLSearchParams(location.search);
	const inst_name = params.get('name');

	if (!inst_name) {
		// eslint-disable-next-line no-console -- deliberate operator-visible log on a failure/edge path; listed in the expected-console-message catalogue
		console.error('Instance name is missing!!');
		move_404();
	}

	return inst_name || 'instance-missing!!';
}

export function useInstanceLogs(instance: IInstance | null, options?: {
	lines?: number;
	level?: string;
	keyword?: string;
	cursor?: string;
	file?: string;
	enableAutoRefresh?: boolean;
}) {
	return useQuery({
		queryKey: ['inst_logs', instance?.name, options],
		queryFn: () => instance ? query_get_inst_logs(instance, options) : Promise.resolve({logs: [], has_more: false}),
		enabled: !!instance,
		refetchInterval: options?.enableAutoRefresh ? 5000 : false, // Only auto-refresh if enabled
		staleTime: options?.enableAutoRefresh ? 2000 : Infinity, // Don't mark as stale if auto-refresh disabled
		refetchOnWindowFocus: false, // Disable refetch on window focus
		refetchOnReconnect: false, // Disable refetch on reconnect
	});
}

export function useInstanceLogArchives(instance: IInstance | null) {
	return useQueryInstanceData(['inst_log_archives'], query_get_inst_log_archives, instance);
}
