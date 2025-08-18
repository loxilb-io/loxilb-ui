//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useLiveMetrics} from './advancedMetricsHooks';
import {IHostCount, INewFlowCount, IRequestCount, IServiceDistTrafficData, IEndpointDistributionTraffic, ITypedLiveMetricsResponse} from 'types/metrics';
import {IInstance} from 'types/oam';
import {useMemo} from 'react';

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export function useMetrics(instance: IInstance | null) {
	// Use new advanced metrics API
	const {data: rawLiveMetrics, isLoading, error} = useLiveMetrics(instance, 2);
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;

	// Extract data in the same format as before for backward compatibility
	const endpointSnapshot = useMemo((): IEndpointDistributionTraffic => {
		// This would need to come from a different endpoint or be calculated
		// For now, return empty object to maintain compatibility
		return {};
	}, []);

	const hostCount: IHostCount = useMemo(() => ({
		healthy_host_count: liveMetrics?.critical?.healthy_endpoints_count ?? 0,
		unhealthy_host_count: liveMetrics?.critical?.unhealthy_endpoints_count ?? 0,
	}), [liveMetrics]);

	const reqCounter: IRequestCount = useMemo(() => ({
		total_requests: liveMetrics?.critical?.total_requests ?? 0,
		total_requests_per_service: liveMetrics?.critical?.total_requests_per_service ? [
			{
				name: 'total',
				value: liveMetrics.critical.total_requests_per_service
			}
		] : [],
	}), [liveMetrics]);

	const serviceDistTraffic: IServiceDistTrafficData = useMemo(() => {
		// This would need to come from a different endpoint or be calculated
		// For now, return empty object to maintain compatibility
		return {};
	}, []);

	const newFlowCount: INewFlowCount = useMemo(() => ({
		new_flow_count: liveMetrics?.critical?.new_flow_count ?? 0,
	}), [liveMetrics]);

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
