//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
	query_get_metrics_endpoint,
	query_get_metrics_hostcount,
	query_get_metrics_newflowcount,
	query_get_metrics_req_count,
	query_get_metrics_service_dist_traffic,
} from 'connector/instance/metrics';
import {IHostCount, INewFlowCount, IRequestCount, IServiceDistTrafficData} from 'types/metrics';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export function useMetrics(instance: IInstance | null) {
	const {data: endpointSnapshot, isLoading: epLoading, error: epError} = useQueryInstanceData(['metrics', 'endpoint'], query_get_metrics_endpoint, instance);
	const {data: hostCount = {} as IHostCount, isLoading: hcLoading, error: hcError} = useQueryInstanceData(['metrics', 'host-count'], query_get_metrics_hostcount, instance);

	const {data: reqCounterRaw, isLoading: rcLoading, error: rcError} = useQueryInstanceData(['metrics', 'req-counter'], query_get_metrics_req_count, instance);
	const reqCounter: IRequestCount = {
		total_requests: reqCounterRaw?.total_requests ?? 0,
		total_requests_per_service: reqCounterRaw?.total_requests_per_service ?? [],
	};

	const {
		data: serviceDistTraffic = {} as IServiceDistTrafficData,
		isLoading: sdLoading,
		error: sdError,
	} = useQueryInstanceData(['metrics', 'service-dist-traffic'], query_get_metrics_service_dist_traffic, instance);

	const {
		data: newFlowCount = {} as INewFlowCount,
		isLoading: nfLoading,
		error: nfError,
	} = useQueryInstanceData(['metrics', 'new-flow-count'], query_get_metrics_newflowcount, instance);

	const isLoading = epLoading || rcLoading || sdLoading || hcLoading || nfLoading;
	const error = epError || rcError || sdError || hcError || nfError;

	return {
		endpointSnapshot,
		reqCounter,
		serviceDistTraffic,
		hostCount,
		newFlowCount,
		isLoading,
		error,
	};
}
