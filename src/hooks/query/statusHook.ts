//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {query_get_audit_rest, query_get_capability_status, query_get_device_status, query_get_filesystem_status, query_get_process_status, query_get_log_level} from 'connector/instance/status';
import {CapabilityVerdict, capabilityVerdict} from 'types/capability_status';
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

/**
 * Runtime capability readiness for the selected gateway.
 *
 * ⚠️ Cadence is deliberate and neither of the two obvious choices.
 * `staleTime: Infinity` is wrong: the verdict is a property of the gateway's
 * launch environment, so it changes when someone restarts the gateway WITH the
 * seed — the exact event an operator is waiting on — and a frozen query would
 * keep telling them it is still unavailable for the rest of the session. A
 * poll is equally wrong: nothing changes between restarts, so polling would
 * spend requests to re-learn the same sentence. The default read (refetch on
 * mount and on window focus) lands on the right moments: a form re-reads it
 * when it is opened, which is when the answer decides what to render.
 *
 * ⚠️ Pass `null` unless the instance is a POSITIVELY identified gateway.
 * `/status/capabilities` is gateway-only in the capability map, and a plain
 * loxilb instance must never see the request (request-side contract guard, the
 * same rule the model-profile and JWT-profile reads follow).
 */
export function useGatewayCapabilities(instance: IInstance | null) {
	const instance_id = instance?.id ? instance.id.toString() : '';
	return useQueryInstanceData(['status', 'capabilities', instance_id], query_get_capability_status, instance);
}

/**
 * One capability's verdict for the selected gateway.
 *
 * ⭐ An UNREAD query (no instance yet, still loading, or a read that failed)
 * yields `unknown`, never `not-ready`. A control must not be withdrawn because
 * we have not finished asking — see the rule in types/capability_status.ts.
 */
export function useCapabilityVerdict(instance: IInstance | null, name: string): CapabilityVerdict {
	const {data} = useGatewayCapabilities(instance);
	return capabilityVerdict(data, name);
}

export const AUDIT_REST_REFETCH_MS = 30_000;

/**
 * The audit trail's REST status for the System page (urgent signals only).
 *
 * ⚠️ Not useQueryInstanceData: that retries every non-404 three times at 3 s
 * and never polls. Here a refusal is final (401/403/404 are not retried; 403
 * and 404 arrive as data from the connector anyway), and the read polls every
 * 30 s while a component using it is mounted; react-query stops the interval
 * when the last observer unmounts, so leaving the page stops the requests.
 *
 * ⚠️ Pass `null` unless the instance is a POSITIVELY identified gateway.
 */
export function useGatewayAuditRest(instance: IInstance | null) {
	return useQuery({
		queryKey: ['status', 'audit', instance?.id ?? ''],
		queryFn: () => query_get_audit_rest(instance!),
		enabled: !!instance,
		refetchInterval: AUDIT_REST_REFETCH_MS,
		retry: (failureCount, error) => !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && failureCount < 3,
		retryDelay: 3000,
	});
}
