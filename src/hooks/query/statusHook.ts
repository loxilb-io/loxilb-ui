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

	// FIXME: Uncoment after solve filesystem api issues.
	// const {data: filesystemAttr = [], isLoading: fsLoading, error: fsError} = useQueryInstanceData(['status', 'filesystem', instance_id], query_get_filesystem_status, instance);
	
	// Dummy filesystem data until API issues are resolved
	// FIXME: After remove dummy datas
	const filesystemAttr = [
		{
			fileSystem: '/dev/sda1',
			type: 'ext4',
			size: '50G',
			used: '25G',
			avail: '23G',
			usePercent: '52%',
			mountedOn: '/'
		},
		{
			fileSystem: '/dev/sda2',
			type: 'ext4',
			size: '100G',
			used: '45G',
			avail: '50G',
			usePercent: '47%',
			mountedOn: '/var'
		},
		{
			fileSystem: 'tmpfs',
			type: 'tmpfs',
			size: '2.0G',
			used: '0',
			avail: '2.0G',
			usePercent: '0%',
			mountedOn: '/tmp'
		}
	];
	const fsLoading = false;
	const fsError = null;

	const {data: processAttr = [], isLoading: psLoading, error: psError, refetch: refetchProcess} = useQueryInstanceData(['status', 'process', instance_id], query_get_process_status, instance);
	const {data: systemInfo, isLoading: devLoading, error: devError, refetch: refetchDevice} = useQueryInstanceData(['status', 'device', instance_id], query_get_device_status, instance);

	const isLoading = fsLoading || psLoading || devLoading;
	const error = fsError || psError || devError;

	const refetch = () => {
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
