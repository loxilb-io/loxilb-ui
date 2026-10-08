//---------------------------------------------------------
// Audit trail configuration (/audit/policy, /audit/sink,
// /audit/sinks/{name}, /audit/rotate)
//---------------------------------------------------------
// Reads are for administrators and operators; every write is for an
// administrator only (the management backend refuses the rest with 403).
// The trail's status read lives with the System page's signals
// (status.ts `query_get_audit_rest`).
//
// ⚠️ Call only for a POSITIVELY identified gateway: plain loxilb has no
// /audit/*.
import type {AuditComplianceSinkWrite, AuditNamedSinkWrite, AuditPolicyValues, IAuditNamedSink, IAuditPolicy, IAuditRotateResult} from 'types/audit_config';
import type {IAuditSink} from 'types/audit_status';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import {pathRefusal, unsendableInPath} from '../fetcher/pathSegment';

/** `{}` is an answer: a gateway with no audit writer has no policy to report. */
export async function query_get_audit_policy(instance: IInstance): Promise<IAuditPolicy> {
	const resp = await GET_INST<IAuditPolicy>(instance, `/audit/policy`);
	assertOk(resp, 'Get Audit Policy');
	return (resp.data ?? {}) as IAuditPolicy;
}

/** Replaces the whole policy: `values` carries all six fields, zeros included. */
export async function request_set_audit_policy(instance: IInstance, values: AuditPolicyValues): Promise<OpResult> {
	return runOp('audit.set_policy', () => POST_INST(instance, `/audit/policy`, values));
}

export async function request_rotate_audit_segment(instance: IInstance): Promise<OpResult<IAuditRotateResult>> {
	return runOp('audit.rotate', () => POST_INST<IAuditRotateResult>(instance, `/audit/rotate`));
}

/** `{}` is an answer: no compliance sink is configured. */
export async function query_get_audit_sink(instance: IInstance): Promise<IAuditSink> {
	const resp = await GET_INST<IAuditSink>(instance, `/audit/sink`);
	assertOk(resp, 'Get Audit Sink');
	return (resp.data ?? {}) as IAuditSink;
}

export async function request_set_audit_sink(instance: IInstance, body: AuditComplianceSinkWrite): Promise<OpResult> {
	return runOp('audit.set_sink', () => POST_INST(instance, `/audit/sink`, body));
}

/** Stops the compliance sink. Nothing but the flag is sent: the gateway drops the rest. */
export async function request_disable_audit_sink(instance: IInstance): Promise<OpResult> {
	return runOp('audit.disable_sink', () => POST_INST(instance, `/audit/sink`, {enabled: false}));
}

/**
 * One named sink, or `null` when the gateway has none of that name. A 404 is
 * the answer a delete is confirmed by, so it is data here, not a failure.
 */
export async function query_get_audit_named_sink(instance: IInstance, name: string): Promise<IAuditNamedSink | null> {
	const resp = await GET_INST<IAuditNamedSink>(instance, `/audit/sinks/${encodeURIComponent(name)}`);
	if (resp.code === 404) return null;
	assertOk(resp, 'Get Audit Named Sink');
	return (resp.data ?? {}) as IAuditNamedSink;
}

/** Creates the sink or replaces it whole; its counters start again either way. */
export async function request_put_audit_named_sink(instance: IInstance, name: string, body: AuditNamedSinkWrite): Promise<OpResult> {
	if (unsendableInPath(name)) return pathRefusal('audit.put_named_sink');
	return runOp('audit.put_named_sink', () => PUT_INST(instance, `/audit/sinks/${encodeURIComponent(name)}`, body));
}

export async function request_delete_audit_named_sink(instance: IInstance, name: string): Promise<OpResult> {
	if (unsendableInPath(name)) return pathRefusal('audit.delete_named_sink');
	return runOp('audit.delete_named_sink', () => DELETE_INST(instance, `/audit/sinks/${encodeURIComponent(name)}`));
}
