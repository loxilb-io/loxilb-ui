//---------------------------------------------------------
// Audit trail configuration reads (the Audit Trail page)
//---------------------------------------------------------
// These are settings, not signals: they are read when the page opens and
// after each change, never on a timer. A form is filled from them, and a poll
// that landed mid-edit would be asking the operator to compare two versions.
//
// ⚠️ Pass `null` unless the instance is a POSITIVELY identified gateway and the
// role may read the audit configuration (AUDIT_SINK_READER_ROLES).
import {useQueries, useQuery} from '@tanstack/react-query';
import {query_get_audit_named_sink, query_get_audit_policy, query_get_audit_sink} from 'connector/instance/audit';
import {IInstance} from 'types/oam';
import {kvExactStatusRetry} from './kvExactStatusHook';

export const auditPolicyKey = (instance: IInstance | null) => ['instance', 'audit', 'policy', instance?.id] as const;
export const auditSinkKey = (instance: IInstance | null) => ['instance', 'audit', 'sink', instance?.id] as const;
export const auditNamedSinkKey = (instance: IInstance | null, name: string) => ['instance', 'audit', 'sinks', instance?.id, name] as const;

const SETTINGS_READ = {retry: kvExactStatusRetry, retryDelay: 3000, staleTime: 0, refetchOnWindowFocus: false} as const;

export function useAuditPolicy(instance: IInstance | null) {
	return useQuery({queryKey: auditPolicyKey(instance), queryFn: () => query_get_audit_policy(instance!), enabled: !!instance, ...SETTINGS_READ});
}

export function useAuditSink(instance: IInstance | null) {
	return useQuery({queryKey: auditSinkKey(instance), queryFn: () => query_get_audit_sink(instance!), enabled: !!instance, ...SETTINGS_READ});
}

/** One read per name. The gateway has no route that lists named sinks with their settings. */
export function useAuditNamedSinks(instance: IInstance | null, names: readonly string[]) {
	return useQueries({
		queries: names.map(name => ({queryKey: auditNamedSinkKey(instance, name), queryFn: () => query_get_audit_named_sink(instance!, name), enabled: !!instance, ...SETTINGS_READ})),
	});
}
