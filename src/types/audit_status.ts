//---------------------------------------------------------
// Audit trail REST status (/audit/status + /audit/sink)
//---------------------------------------------------------
// The audit writer's health comes from Prometheus (observability/auditWriter).
// This adds ONLY what the metrics cannot say, and only when it is urgent:
//   - a configured remote sink that is not connected (no sink metric exists);
//   - the event id of the most recent orphaned intent, so an investigator can
//     find it in the trail (the metric carries the count, not the id).
// A healthy answer adds nothing: deep fields (segments, producers, retention,
// queue high-water marks) belong to Grafana and the CLI.
//
// ⚠️ Every field is `omitempty` in the gateway models (api/models/audit_*.go):
// an absent boolean is false and an absent count is 0. So `{}` from
// /audit/sink means "no sink configured", and a sink with `enabled:true` and
// no `connected` is a sink that is NOT connected.
import type {GwSchema} from 'api';

export type IAuditStatus = GwSchema<'AuditStatus'>;
export type IAuditSink = GwSchema<'AuditSink'>;

/**
 * One read of the audit REST surface.
 * - `forbidden`: the caller lacks gateway administrator rights (403).
 * - `absent`: the gateway predates the audit API (404).
 * - `ok`: the status was read; `sink` is undefined when its own read was refused.
 */
export type AuditRestRead =
	| {kind: 'forbidden'}
	| {kind: 'absent'}
	| {kind: 'ok'; status: IAuditStatus; sink?: IAuditSink};

export interface IAuditSinkDown {
	address?: string;
	lastError?: string;
	writeErrors: number;
}

/** The urgent signals, and nothing else. `undefined` data (unread or failed read) adds nothing. */
export type AuditRestSignals =
	| {kind: 'none'}
	| {kind: 'forbidden'}
	| {kind: 'ok'; sinkDown?: IAuditSinkDown; orphan?: {count: number; eventId?: string}};

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function auditRestSignals(read: AuditRestRead | undefined): AuditRestSignals {
	if (!read || read.kind === 'absent') return {kind: 'none'};
	if (read.kind === 'forbidden') return {kind: 'forbidden'};

	const {status, sink} = read;
	// A writer that never started makes every other field meaningless, and the
	// metrics already say so loudly ("not configured").
	if (status.available === false) return {kind: 'ok'};

	const signals: AuditRestSignals = {kind: 'ok'};
	if (sink?.enabled === true && sink.connected !== true) {
		signals.sinkDown = {
			address: sink.address || undefined,
			lastError: sink.last_error || undefined,
			writeErrors: count(sink.write_errors),
		};
	}
	const orphaned = count(status.orphaned_intents);
	if (orphaned > 0) signals.orphan = {count: orphaned, eventId: status.last_orphan_event_id || undefined};
	return signals;
}
