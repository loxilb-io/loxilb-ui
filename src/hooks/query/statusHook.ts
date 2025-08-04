//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_device_status, query_get_filesystem_status, query_get_process_status} from 'connector/instance/status';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function useStatus(instance: IInstance | null) {
	const instance_id = instance?.id ? instance.id.toString() : '';

	const {data: filesystemAttr = [], isLoading: fsLoading, error: fsError} = useQueryInstanceData(['status', 'filesystem', instance_id], query_get_filesystem_status, instance);
	const {data: processAttr = [], isLoading: psLoading, error: psError} = useQueryInstanceData(['status', 'process', instance_id], query_get_process_status, instance);
	const {data: systemInfo, isLoading: devLoading, error: devError} = useQueryInstanceData(['status', 'device', instance_id], query_get_device_status, instance);

	const isLoading = fsLoading || psLoading || devLoading;
	const error = fsError || psError || devError;

	return {
		filesystemAttr,
		processAttr,
		systemInfo,
		isLoading,
		error,
	};
}
