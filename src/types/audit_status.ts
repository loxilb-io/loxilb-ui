//---------------------------------------------------------
// Audit trail REST status (/audit/status + /audit/sink)
//---------------------------------------------------------
// The audit writer's health comes from Prometheus (observability/auditWriter).
// This adds ONLY what the metrics cannot say, and only when it is urgent:
//   - a configured sink that is not sending, and why: the status lists every
//     sink with the gateway's own word for its state (the connected gauge is 0
//     for a sink that is still starting as well as for one that is away);
//   - the event id of the most recent orphaned intent, so an investigator can
//     find it in the trail (the metric carries the count, not the id).
// A healthy answer adds nothing: deep fields (segments, producers, retention,
// queue high-water marks) belong to Grafana and the CLI.
//
// ⚠️ Every field is `omitempty` in the gateway models (api/models/audit_*.go):
// an absent boolean is false and an absent count is 0. So `{}` from
// /audit/sink means "no sink configured". A sink's `state` is omitempty too,
// and an absent state is NOT a healthy one: it is reported as unreported.
//
// ⭐ `status.sinks[]` is readable by every role; /audit/sink is refused to a
// viewer and adds only the compliance sink's address, last error and failed
// submissions. So the state always comes from the list, and /audit/sink
// decides it only for a gateway whose status has no `sinks` key at all (one
// older than the per-sink list).
import type {GwSchema} from 'api';

export type IAuditStatus = GwSchema<'AuditStatus'>;
export type IAuditSink = GwSchema<'AuditSink'>;
export type IAuditSinkStatus = GwSchema<'AuditSinkStatus'>;

/**
 * One read of the audit REST surface.
 * - `forbidden`: the caller lacks gateway administrator rights (403).
 * - `absent`: the gateway predates the audit API (404).
 * - `ok`: the status was read; `sink` is undefined when its own read was not
 *   sent (the role may not have it) or did not answer.
 */
export type AuditRestRead =
	| {kind: 'forbidden'}
	| {kind: 'absent'}
	| {kind: 'ok'; status: IAuditStatus; sink?: IAuditSink};

/** The compliance sink's name, in the status list and as the metrics' `sink` label (gateway auditComplianceSink). */
export const AUDIT_COMPLIANCE_SINK = 'compliance';

/**
 * Why a sink is raised. The first three are the gateway's states (pkg/audit
 * Sink*); `starting` and `connected` raise nothing. `unreported` is a sink
 * with no state at all, `unrecognized` one whose state this build does not
 * know: neither may be shown as healthy.
 */
export type AuditSinkCondition = 'disconnected' | 'stalled' | 'stopped' | 'unreported' | 'unrecognized';

/** One sink with something urgent to say. */
export interface IAuditSinkSignal {
	name: string;
	compliance: boolean;
	/** Absent for a sink that is sending but lost records to retention. */
	condition?: AuditSinkCondition;
	/** The gateway's word, kept only when it is `unrecognized`. */
	state?: string;
	/** Times retention removed a segment before this sink had read it. */
	lagDrops: number;
	/** Compliance sink only, and only when /audit/sink was read. */
	address?: string;
	lastError?: string;
	writeErrors: number;
}

/**
 * The urgent signals, and nothing else.
 * - `none`: nothing was read yet, or the gateway has no audit API.
 * - `unknown`: the read failed. Not silence: no alert would read as healthy.
 */
export type AuditRestSignals =
	| {kind: 'none'}
	| {kind: 'forbidden'}
	| {kind: 'unknown'}
	| {kind: 'ok'; sinks?: IAuditSinkSignal[]; orphan?: {count: number; eventId?: string}};

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

const QUIET_STATES = ['starting', 'connected'];
const RAISED_STATES = ['disconnected', 'stalled', 'stopped'] as const;

function sinkCondition(state: unknown): Pick<IAuditSinkSignal, 'condition' | 'state'> {
	if (typeof state !== 'string' || state === '') return {condition: 'unreported'};
	if (QUIET_STATES.includes(state)) return {};
	const raised = RAISED_STATES.find(s => s === state);
	return raised ? {condition: raised} : {condition: 'unrecognized', state};
}

function listedSinks(list: unknown[], sink: IAuditSink | undefined): IAuditSinkSignal[] {
	const out: IAuditSinkSignal[] = [];
	for (const el of list) {
		if (!el || typeof el !== 'object') continue;
		const s = el as IAuditSinkStatus;
		const compliance = s.compliance === true;
		const signal: IAuditSinkSignal = {
			name: s.name || (compliance ? AUDIT_COMPLIANCE_SINK : ''),
			compliance,
			...sinkCondition(s.state),
			lagDrops: count(s.lag_drops),
			writeErrors: 0,
		};
		if (!signal.condition && signal.lagDrops === 0) continue;
		if (compliance && sink) {
			signal.address = sink.address || undefined;
			signal.lastError = sink.last_error || undefined;
			signal.writeErrors = count(sink.write_errors);
		}
		out.push(signal);
	}
	return out;
}

/**
 * `readFailed` is the query's error flag. React Query keeps the last good
 * answer when a refetch fails, and an alert must be about now, so a failed
 * read is `unknown` whatever `read` still holds.
 */
export function auditRestSignals(read: AuditRestRead | undefined, readFailed = false): AuditRestSignals {
	if (readFailed) return {kind: 'unknown'};
	if (!read || read.kind === 'absent') return {kind: 'none'};
	if (read.kind === 'forbidden') return {kind: 'forbidden'};

	const {status, sink} = read;
	// A writer that never started makes every other field meaningless, and the
	// metrics already say so loudly ("not configured").
	if (status.available === false) return {kind: 'ok'};

	const signals: AuditRestSignals = {kind: 'ok'};
	const listed = (status as {sinks?: unknown}).sinks;
	let sinks: IAuditSinkSignal[] = [];
	if (Array.isArray(listed)) {
		sinks = listedSinks(listed, sink);
	} else if (listed === undefined && sink?.enabled === true && sink.connected !== true) {
		// No `sinks` key: a gateway older than the list. `null` is the list of
		// a gateway with no sink, and falls through to nothing.
		sinks = [{
			name: AUDIT_COMPLIANCE_SINK,
			compliance: true,
			condition: 'disconnected',
			lagDrops: 0,
			address: sink.address || undefined,
			lastError: sink.last_error || undefined,
			writeErrors: count(sink.write_errors),
		}];
	}
	if (sinks.length > 0) signals.sinks = sinks;
	const orphaned = count(status.orphaned_intents);
	if (orphaned > 0) signals.orphan = {count: orphaned, eventId: status.last_orphan_event_id || undefined};
	return signals;
}

/**
 * The named sinks the status lists, in the gateway's order. `undefined` when
 * the status has no `sinks` key: a gateway older than the list cannot say, and
 * "cannot say" is not "none". `null` is the list of a gateway with no sink.
 */
export function namedSinkNames(status: IAuditStatus): string[] | undefined {
	const listed = (status as {sinks?: unknown}).sinks;
	if (listed === null) return [];
	if (!Array.isArray(listed)) return undefined;
	const names: string[] = [];
	for (const el of listed) {
		if (!el || typeof el !== 'object') continue;
		const sink = el as IAuditSinkStatus;
		if (sink.compliance === true || !sink.name || sink.name === AUDIT_COMPLIANCE_SINK) continue;
		if (!names.includes(sink.name)) names.push(sink.name);
	}
	return names;
}
