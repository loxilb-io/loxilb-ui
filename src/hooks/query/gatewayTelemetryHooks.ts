//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {
	IDiagnosticsStatus,
	IGpuStatus,
	ITimedRead,
	IWorkerMetricsEntry,
	query_get_diagnostics,
	query_get_gpu_status,
	query_get_worker_metrics,
} from 'connector/instance/gatewayTelemetry';
import {IInstance} from 'types/oam';
import {useInstanceFlavor} from './flavorHook';
import {kvExactStatusRetry} from './kvExactStatusHook';

//---------------------------------------------------------
// Gateway telemetry REST hooks (UI-MON-009)
//---------------------------------------------------------
// Independent query keys with independent receive timestamps — none of
// these is atomically consistent with the Prometheus snapshot or with each
// other. Cadence follows the kvExact precedent (bounded retry, no polling
// in hidden tabs) with per-source intervals:
// - GPU status is the authoritative enabled-state source and polls slowly;
// - worker metrics poll fast, but ONLY while GPU status proves the feature
//   enabled (the server refuses ingestion older than 10 s, so 5 s keeps the
//   table honest without hammering a disabled surface).
//
// Every hook is flavor-guarded INTERNALLY as well as by its page: whatever
// a caller passes, no request leaves for an instance that has not RESOLVED
// to the gateway flavor — a pending, denied, or unavailable probe answers
// narrow, so an OSS instance (or a denied session) never sees these
// gateway-only paths.

export const GPU_STATUS_CADENCE_MS = 30_000;
export const WORKER_METRICS_CADENCE_MS = 5_000;
export const DIAGNOSTICS_CADENCE_MS = 30_000;

const RETRY_DELAY = (attempt: number) => Math.min(3000 * 2 ** attempt, 15000);

function useGatewayResolved(instance: IInstance | null): boolean {
	const {flavor} = useInstanceFlavor(instance);
	return flavor === 'inference-gateway';
}

export function useGpuStatus(instance: IInstance | null, active: boolean) {
	const gateway = useGatewayResolved(instance);
	return useQuery<ITimedRead<IGpuStatus>>({
		queryKey: ['instance', 'gpu-status', instance?.id],
		queryFn: () => query_get_gpu_status(instance!),
		enabled: !!instance && active && gateway,
		refetchInterval: GPU_STATUS_CADENCE_MS,
		refetchIntervalInBackground: false,
		retry: kvExactStatusRetry,
		retryDelay: RETRY_DELAY,
		staleTime: 5000,
	});
}

/**
 * @param monitoringEnabled the authoritative `/config/gpu/status`.enabled
 *        answer; the worker list only polls while it is provably true.
 */
export function useWorkerMetrics(instance: IInstance | null, active: boolean, monitoringEnabled: boolean) {
	const gateway = useGatewayResolved(instance);
	return useQuery<ITimedRead<IWorkerMetricsEntry[]>>({
		queryKey: ['instance', 'worker-metrics', instance?.id],
		queryFn: () => query_get_worker_metrics(instance!),
		enabled: !!instance && active && gateway && monitoringEnabled,
		refetchInterval: WORKER_METRICS_CADENCE_MS,
		refetchIntervalInBackground: false,
		retry: kvExactStatusRetry,
		retryDelay: RETRY_DELAY,
		staleTime: 2000,
	});
}

export function useDiagnostics(instance: IInstance | null, active: boolean) {
	const gateway = useGatewayResolved(instance);
	return useQuery<ITimedRead<IDiagnosticsStatus>>({
		queryKey: ['instance', 'diagnostics', instance?.id],
		queryFn: () => query_get_diagnostics(instance!),
		enabled: !!instance && active && gateway,
		refetchInterval: DIAGNOSTICS_CADENCE_MS,
		refetchIntervalInBackground: false,
		retry: kvExactStatusRetry,
		retryDelay: RETRY_DELAY,
		staleTime: 5000,
	});
}
