//---------------------------------------------------------
// SimpleResponse → OpResult adapter 
//---------------------------------------------------------
// The single place HTTP outcomes become user-meaningful statuses.
// RULE (binding, from the task contract): anything unrecognized maps to
// `failed`, never to success. Raw server text goes only into rawDetail.

import {ApiError, isMutationFailure, SimpleResponse} from './fetcher_base';
import {retryAfterSeconds} from 'utils/retryAfter';
import {OpOrigin, OpResult} from './opResult';
import {AUDIT_UNAVAILABLE_KEY, CONFLICT_KEY, IDENTITY_UNAVAILABLE_KEY, MAINTENANCE_KEY, NOT_ENABLED_KEY, PRECONDITION_KEY, RATE_LIMITED_KEY, STATUS_LOCALE_KEYS} from './opResultCodes';

// Optional until the frozen error-code contract lands ( external
// dependency); absent headers simply leave correlationId undefined.
const CORRELATION_HEADER = 'X-Correlation-Id';
// Added by the management backend to say who produced a failure. Three states:
// `gateway`, `oam`, or absent (its own plain session 401s, and backends that
// predate the marker).
const ORIGIN_HEADER = 'X-Loxi-Error-Origin';

/**
 * Whether the request could have changed anything.
 *
 * The default everywhere is `mutation`, on purpose. A read wrongly treated as
 * a change loses a Retry button; a change wrongly treated as a read is told to
 * "try again" about something that may already have been applied.
 */
export type OpKind = 'mutation' | 'read';

function originOf(resp: SimpleResponse): OpOrigin | undefined {
	const origin = resp.headers?.get?.(ORIGIN_HEADER)?.trim().toLowerCase();
	return origin === 'gateway' || origin === 'oam' ? origin : undefined;
}

/**
 * What a failure carries besides its status: the wait the server named and who
 * answered. Left out entirely when absent, so a result never holds a wait
 * nobody asked for.
 */
function provenanceOf(resp: SimpleResponse): Pick<OpResult, 'retryAfterSeconds' | 'origin'> {
	const wait = retryAfterSeconds(resp.headers?.get?.('Retry-After'));
	const origin = originOf(resp);
	return {...(wait === null ? {} : {retryAfterSeconds: wait}), ...(origin ? {origin} : {})};
}

/**
 * The 503s that name their cause. Neither producer sends a machine code, so
 * the match is on the field each one fills with a fixed string — the whole
 * field, never a fragment of the sentence beside it:
 *   Gateway  `message: "Audit unavailable"`  the audit trail cannot take the record
 *   Gateway  `message: "Maintenance mode"`   boot replay, restore freeze, operator maintenance
 *   backend  `error: "Gateway service identity unavailable"`, with its own marker
 * Anything else — including the bare 503 the audit policy and sink handlers
 * answer with no body — stays the generic one.
 */
function refusal503(resp: SimpleResponse, op: string): Pick<OpResult, 'code' | 'localeKey'> {
	const d = resp.data as any;
	const message = text(d?.message);
	if (message === 'Audit unavailable') return {code: `${op}.audit_unavailable`, localeKey: AUDIT_UNAVAILABLE_KEY};
	if (message === 'Maintenance mode') return {code: `${op}.maintenance`, localeKey: MAINTENANCE_KEY};
	if (originOf(resp) === 'oam' && text(d?.error) === 'Gateway service identity unavailable') {
		return {code: `${op}.identity_unavailable`, localeKey: IDENTITY_UNAVAILABLE_KEY};
	}
	return {code: `${op}.unavailable`, localeKey: STATUS_LOCALE_KEYS.unavailable};
}

function text(v: unknown): string | undefined {
	return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function rawDetailOf(resp: SimpleResponse): string | undefined {
	const d = resp.data as any;
	// `error` is authoritative where it appears (OAM, and the gateway's own
	// envelope) — one field, never split.
	const authoritative = text(d?.error);
	if (authoritative) return authoritative;

	// ⚠️ loxilb splits a rejection in two: `message` is the generic CLASS
	// ("Malformed arguments for API call") and `result` carries the only
	// sentence that names the actual cause. Taking `message` first kept the
	// half that says nothing, so the reason never reached the diagnostics,
	// the correlation trail, or an E2E failure message. Take BOTH — the class
	// is what the gateway's logs are indexed by, the reason is what a human
	// needs — and de-duplicate, because most backends set only one of them.
	const cls = text(d?.message);
	const reason = text(d?.result);
	if (cls && reason && cls !== reason) return `${cls}: ${reason}`;

	return cls || reason || text(resp.message);
}

export function fromSimpleResponse<T = unknown>(resp: SimpleResponse<T> | null | undefined, op: string, kind: OpKind = 'mutation'): OpResult<T> {
	// Fed garbage (undefined / no numeric code) — a defect upstream, but the
	// adapter must degrade to `failed`, never throw into a white screen.
	if (!resp || typeof resp.code !== 'number') {
		return {status: 'failed', code: `${op}.malformed_response`, localeKey: STATUS_LOCALE_KEYS.failed, retryable: false};
	}

	const correlationId = resp.headers?.get?.(CORRELATION_HEADER) ?? undefined;
	const common = {correlationId, httpStatus: resp.code, rawDetail: rawDetailOf(resp), ...provenanceOf(resp)};

	if (resp.code === 401 || resp.code === 403) {
		return {status: 'denied', code: `${op}.denied`, localeKey: STATUS_LOCALE_KEYS.denied, retryable: false, ...common};
	}
	if (resp.code === 400 || resp.code === 422) {
		return {status: 'invalid', code: `${op}.rejected`, localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, ...common};
	}
	// 409: the request conflicts with existing server state (OAM answers 409
	// for a duplicate instance registration — 2026-08-05 hardening). Deliberate
	// addition over the task-doc snippet: user-correctable, so `invalid`.
	if (resp.code === 409) {
		return {status: 'invalid', code: `${op}.conflict`, localeKey: CONFLICT_KEY, retryable: false, ...common};
	}
	if (resp.code === 429) {
		return {status: 'denied', code: `${op}.rate_limited`, localeKey: RATE_LIMITED_KEY, retryable: true, ...common};
	}
	// 402: the gateway license-gates some feature families (AI) — the caller
	// is authenticated but the feature is not purchasable/active. Denied, with
	// a distinct code so pages and E2E can branch on it.
	if (resp.code === 402) {
		return {status: 'denied', code: `${op}.payment_required`, localeKey: STATUS_LOCALE_KEYS.denied, retryable: false, ...common};
	}
	// ⭐⭐ 412: a refusal whose cause is the GATEWAY'S launch environment, not
	// the request. The gateway added this status precisely so a client can tell
	// the two apart — rendered as the 400 it used to be, the response said
	// "Malformed arguments for API call" about a body that was valid, and a UI
	// could not decide whether to tell the operator to fix their input or fix
	// their gateway.
	//
	// ⚠️ `failed`, deliberately NOT `invalid`. `invalid` is the bucket whose
	// whole message is "fix what you submitted", and the defining property of a
	// precondition refusal is that no submission can satisfy it. And NOT
	// retryable: the same request will be refused identically until someone
	// changes the deployment, so offering a retry would be a lie with a button
	// on it. `rawDetail` carries the gateway's sentence, which is the only part
	// that tells an operator what to change.
	//
	// ⚠️ This branch is for EVERY operation, not only the declared ones. The
	// gateway specification declares 412 on `POST /config/loadbalancer` and the
	// LB tuple PATCH (pinned in src/api/contract.test.ts), but the status comes
	// from the gateway's shared error mapper, so other operations can answer it
	// without declaring it. Do not narrow the branch to the declared operations.
	if (resp.code === 412) {
		return {status: 'failed', code: `${op}.precondition_failed`, localeKey: PRECONDITION_KEY, retryable: false, ...common};
	}
	// 501: the feature is not compiled/enabled in this gateway launch config
	// (e.g. /config/ai/* answers 501 until --userservice is on). Still `failed`
	// (unknown⇒failed philosophy — retrying cannot help), but with an honest
	// message and a distinct code instead of a generic failure.
	if (resp.code === 501) {
		return {status: 'failed', code: `${op}.not_implemented`, localeKey: NOT_ENABLED_KEY, retryable: false, ...common};
	}
	// 503 is "not performed", for a change as much as for a read: the Gateway
	// and the management backend both answer it before acting.
	if (resp.code === 503) {
		return {status: 'unavailable', ...refusal503(resp, op), retryable: true, ...common};
	}
	// 502, 504 and 0 are the hop losing the ANSWER. For a read that is an
	// outage and a retry is harmless. For a change it says nothing about
	// whether the request arrived: a timed-out create may have created, and a
	// second one then fails as a duplicate or — for an operation that is not
	// idempotent — applies twice. So: unknown, no retry, read the state back.
	//
	// ⚠️ The backend's 502 body does tell "connection refused" from "reset
	// after sending", in prose. It is not read. Prose drifts without anything
	// failing, and the cost of guessing wrong here is a repeated change.
	if (resp.code === 502 || resp.code === 504 || resp.code === 0) {
		if (kind === 'read') {
			return {status: 'unavailable', code: `${op}.unavailable`, localeKey: STATUS_LOCALE_KEYS.unavailable, retryable: true, ...common};
		}
		return {status: 'unknown', code: `${op}.outcome_unknown`, localeKey: STATUS_LOCALE_KEYS.unknown, retryable: false, ...common};
	}
	if (resp.code >= 200 && resp.code < 300) {
		// The legacy 200-{result:"fail"} trap, now mandatory for every caller.
		// acceptedCodes=[resp.code] so only the body envelope is judged here —
		// the HTTP class was already accepted by this branch.
		if (isMutationFailure(resp, [resp.code])) {
			return {status: 'failed', code: `${op}.reported_failure`, localeKey: STATUS_LOCALE_KEYS.failed, retryable: false, ...common};
		}
		// A NON-empty 2xx body that failed to parse (truncated JSON, an HTML
		// error page) must not look healthy. A genuinely empty body is fine —
		// 204/205 and bodyless-200 upserts confirm below with data undefined.
		if (resp.parse_failed) {
			return {status: 'failed', code: `${op}.parse_error`, localeKey: STATUS_LOCALE_KEYS.failed, retryable: false, ...common};
		}
		return {status: 'confirmed', code: `${op}.ok`, localeKey: STATUS_LOCALE_KEYS.confirmed, retryable: false, data: resp.data ?? undefined, correlationId, httpStatus: resp.code};
	}
	return {status: 'failed', code: `${op}.failed`, localeKey: STATUS_LOCALE_KEYS.failed, retryable: false, ...common};
}

/**
 * Standard wrapper for a single-call mutation: adapter mapping plus the
 * network-throw guarantee (a thrown fetch resolves to `unknown`, it never
 * rejects into the page).
 */
export async function runOp<T = unknown>(op: string, call: () => Promise<SimpleResponse<T>>): Promise<OpResult<T>> {
	try {
		return fromSimpleResponse(await call(), op);
	} catch (error) {
		return fromNetworkError(op, error);
	}
}

/**
 * A read connector's thrown error → OpResult.
 *
 * `assertOk` throws an ApiError carrying the HTTP status, and react-query hands
 * that to the page as `query.error`. Reuse the one mapping table above rather
 * than growing a second one, with a single read-specific correction: a read
 * never carries operator input, so `invalid` — whose whole message is "fix what
 * you submitted" (400/422/409) — would send them looking for a form that does
 * not exist. For a GET those codes are simply a failure.
 *
 * Anything that is not an ApiError never reached HTTP at all (transport, DNS,
 * abort, a bug throwing inside the connector) and maps to `unavailable`.
 *
 * This is the read path, and it says so to the mapping: a read that lost its
 * answer is an outage to retry, never an "outcome unknown".
 */
export function fromThrownError(op: string, error: unknown): OpResult<never> {
	const status = error instanceof ApiError ? error.status : undefined;
	if (typeof status !== 'number' || !Number.isFinite(status) || (status >= 200 && status < 300)) {
		return fromNetworkError(op, error, 'read');
	}
	const {message, response} = error as ApiError;
	// The body and headers ride along so a named refusal, the wait and the
	// origin survive the throw. The diagnostics text stays the connector's own
	// message, which already names the operation and the status.
	const mapped = {...fromSimpleResponse<never>({code: status, data: (response?.data ?? null) as never, message, headers: response?.headers}, op, 'read'), rawDetail: message};
	if (mapped.status !== 'invalid') return mapped;
	return {...mapped, status: 'failed', code: `${op}.failed`, localeKey: STATUS_LOCALE_KEYS.failed};
}

/**
 * A thrown fetch (network refusal, DNS, timeout) — there was no HTTP response
 * at all. The browser does not say whether the request left: for a change that
 * is the same "not known" as a 502, for a read it is an outage.
 */
export function fromNetworkError(op: string, error?: unknown, kind: OpKind = 'mutation'): OpResult<never> {
	const rawDetail = error instanceof Error ? error.message : undefined;
	if (kind === 'read') {
		return {status: 'unavailable', code: `${op}.network_error`, localeKey: STATUS_LOCALE_KEYS.unavailable, retryable: true, rawDetail};
	}
	return {status: 'unknown', code: `${op}.outcome_unknown`, localeKey: STATUS_LOCALE_KEYS.unknown, retryable: false, rawDetail};
}

