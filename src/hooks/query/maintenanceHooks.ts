//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {IMaintenanceStatus, query_get_maintenance} from 'connector/instance/maintenance';
import {ITimedRead} from 'connector/instance/gatewayTelemetry';
import {IInstance} from 'types/oam';
import {useInstanceFlavor} from './flavorHook';
import {kvExactStatusRetry} from './kvExactStatusHook';

//---------------------------------------------------------
// Operator maintenance read
//---------------------------------------------------------
// Polled faster while an episode is open: the in-flight counters are what an
// operator watches during a drain. Slow otherwise — another operator may
// enter maintenance, and the page must not go on saying "active".
//
// Flavor-guarded here as well as by the route: no request leaves for an
// instance that has not resolved to the gateway.

export const MAINTENANCE_CADENCE_MS = 30_000;
export const MAINTENANCE_DRAIN_CADENCE_MS = 5_000;

export const maintenanceQueryKey = (instance: IInstance | null) => ['instance', 'maintenance', instance?.id] as const;

export function useMaintenance(instance: IInstance | null) {
	const {flavor} = useInstanceFlavor(instance);
	return useQuery<ITimedRead<IMaintenanceStatus>>({
		queryKey: maintenanceQueryKey(instance),
		queryFn: () => query_get_maintenance(instance!),
		enabled: !!instance && flavor === 'inference-gateway',
		refetchInterval: query => (query.state.data?.data.state === 'maintenance' ? MAINTENANCE_DRAIN_CADENCE_MS : MAINTENANCE_CADENCE_MS),
		refetchIntervalInBackground: false,
		retry: kvExactStatusRetry,
		retryDelay: attempt => Math.min(3000 * 2 ** attempt, 15000),
		staleTime: 0,
	});
}
