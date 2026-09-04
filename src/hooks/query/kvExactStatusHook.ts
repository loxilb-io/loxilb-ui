//---------------------------------------------------------
// KV-exact enforcement status polling (FR-05)
//
// Cadence and lifecycle rules, pinned by the request document:
// - poll only while the status panel is visible AND the rule is strict;
// - fast cadence through pending/degrading, steady cadence after
//   READY/DEGRADED/FAULT — never zero while visible (post-READY drift and
//   degradation must still surface);
// - pause when the browser tab is hidden (refetchIntervalInBackground:
//   false) and stop on unmount / rule / instance change (query key change +
//   enabled: false);
// - 404 is data ("no KV-exact status for this selection"), handled in the
//   connector as null — never an error, never a redirect;
// - 422 is terminal (malformed key — retrying cannot help); transport/503
//   get a bounded backoff, then only manual retry via refetch().
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {query_get_kvexact_status, IKvExactStatusKey} from 'connector/instance/model_profile';
import {IInstance} from 'types/oam';
import {kvExactPollIntervalMs} from 'types/ai_gateway';

const BOUNDED_RETRIES = 2;

export function kvExactStatusRetry(failureCount: number, error: unknown): boolean {
	const status = (error as any)?.status;
	if (status === 401 || status === 403 || status === 404 || status === 422) return false;
	return failureCount < BOUNDED_RETRIES;
}

export function useKvExactStatus(instance: IInstance | null, key: IKvExactStatusKey | null, visible: boolean) {
	const instanceId = instance?.id ? instance.id.toString() : '';
	return useQuery({
		queryKey: ['kvexact_status', instanceId, key?.externalIP ?? '', key?.port ?? 0, key?.protocol ?? '', key?.modelName ?? ''],
		queryFn: () => query_get_kvexact_status(instance!, key!),
		enabled: !!instance && !!key && visible,
		refetchInterval: query => kvExactPollIntervalMs(query.state.data),
		refetchIntervalInBackground: false,
		retry: kvExactStatusRetry,
		retryDelay: attempt => Math.min(3000 * 2 ** attempt, 15000),
		staleTime: 0,
	});
}
