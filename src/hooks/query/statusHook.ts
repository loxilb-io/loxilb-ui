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

	const {data: filesystemAttr = [], isLoading: fsLoading, error: fsError, refetch: refetchFs} = useQueryInstanceData(['status', 'filesystem', instance_id], query_get_filesystem_status, instance);

	const {data: processAttr = [], isLoading: psLoading, error: psError, refetch: refetchProcess} = useQueryInstanceData(['status', 'process', instance_id], query_get_process_status, instance);
	const {data: systemInfo, isLoading: devLoading, error: devError, refetch: refetchDevice} = useQueryInstanceData(['status', 'device', instance_id], query_get_device_status, instance);

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
		refetch,
	};
}

export function useLogLevel(instance: IInstance | null) {
	const instance_id = instance?.id ? instance.id.toString() : '';
	
	return useQueryInstanceData(['status', 'log-level', instance_id], query_get_log_level, instance);
}
