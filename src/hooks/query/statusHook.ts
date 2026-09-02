//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_device_status, query_get_filesystem_status, query_get_process_status, query_get_log_level} from 'connector/instance/status';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function useStatus(instance: IInstance | null) {
	const instance_id = instance?.id ? instance.id.toString() : '';

	const fsQuery = useQueryInstanceData(['status', 'filesystem', instance_id], query_get_filesystem_status, instance);
	const psQuery = useQueryInstanceData(['status', 'process', instance_id], query_get_process_status, instance);
	const devQuery = useQueryInstanceData(['status', 'device', instance_id], query_get_device_status, instance);

	const {data: filesystemAttr = [], isLoading: fsLoading, error: fsError, refetch: refetchFs} = fsQuery;
	const {data: processAttr = [], isLoading: psLoading, error: psError, refetch: refetchProcess} = psQuery;
	const {data: systemInfo, isLoading: devLoading, error: devError, refetch: refetchDevice} = devQuery;

	const isLoading = fsLoading || psLoading || devLoading;
	const error = fsError || psError || devError;

	const refetch = () => {
		refetchFs();
		refetchProcess();
		refetchDevice();
	};

	return {
		filesystemAttr,
		processAttr,
		systemInfo,
		isLoading,
		error,
		// Per-resource errors so a table can flag its own fetch failure without
		// borrowing a sibling call's error.
		fsError,
		psError,
		devError,
		// The queries themselves, for pages that map their own read onto a
		// page state. Three unrelated resources share this hook, so
		// a page must be able to speak for its own read rather than inherit a
		// sibling's outage — the reason the per-resource errors exist too.
		fsQuery,
		psQuery,
		devQuery,
		refetch,
	};
}

export function useLogLevel(instance: IInstance | null) {
	const instance_id = instance?.id ? instance.id.toString() : '';
	
	return useQueryInstanceData(['status', 'log-level', instance_id], query_get_log_level, instance);
}
