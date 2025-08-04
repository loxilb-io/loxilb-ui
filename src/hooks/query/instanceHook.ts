//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {move_404} from 'common';
import {query_get_inst_log_archives, query_get_inst_logs} from 'connector/instance/status';
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
		console.error('Instance name is missing!!');
		move_404();
	}

	return inst_name || 'instance-missing!!';
}

export function useInstanceLogs(instance: IInstance | null) {
	return useQueryInstanceData(['inst_logs'], query_get_inst_logs, instance);
}

export function useInstanceLogArchives(instance: IInstance | null) {
	return useQueryInstanceData(['inst_log_archives'], query_get_inst_log_archives, instance);
}
