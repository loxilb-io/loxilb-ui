//---------------------------------------------------------
// SimpleResponse → OpResult adapter 
//---------------------------------------------------------
// The single place HTTP outcomes become user-meaningful statuses.
// RULE (binding, from the task contract): anything unrecognized maps to
// `failed`, never to success. Raw server text goes only into rawDetail.

import {ApiError, isMutationFailure, SimpleResponse} from './fetcher_base';
import {OpResult} from './opResult';
import {CONFLICT_KEY, NOT_ENABLED_KEY, RATE_LIMITED_KEY, STATUS_LOCALE_KEYS} from './opResultCodes';

// Optional until the frozen error-code contract lands ( external
// dependency); absent headers simply leave correlationId undefined.
const CORRELATION_HEADER = 'X-Correlation-Id';

function rawDetailOf(resp: SimpleResponse): string | undefined {
	const d = resp.data as any;
	const detail = d?.error || d?.message || d?.result || resp.message;
	return typeof detail === 'string' && detail.trim() !== '' ? detail : undefined;
}

export function fromSimpleResponse<T = unknown>(resp: SimpleResponse<T> | null | undefined, op: string): OpResult<T> {
	// Fed garbage (undefined / no numeric code) — a defect upstream, but the
	// adapter must degrade to `failed`, never throw into a white screen.
	if (!resp || typeof resp.code !== 'number') {
		return {status: 'failed', code: `${op}.malformed_response`, localeKey: STATUS_LOCALE_KEYS.failed, retryable: false};
	}

	const correlationId = resp.headers?.get?.(CORRELATION_HEADER) ?? undefined;
	const common = {correlationId, httpStatus: resp.code, rawDetail: rawDetailOf(resp)};

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
	// 501: the feature is not compiled/enabled in this gateway launch config
	// (e.g. /config/ai/* answers 501 until --userservice is on). Still `failed`
	// (unknown⇒failed philosophy — retrying cannot help), but with an honest
	// message and a distinct code instead of a generic failure.
	if (resp.code === 501) {
		return {status: 'failed', code: `${op}.not_implemented`, localeKey: NOT_ENABLED_KEY, retryable: false, ...common};
	}
	// 504 added to the task-doc set (502/503/0): a gateway timeout is the same
	// operator experience — the service is not answering right now.
	if (resp.code === 502 || resp.code === 503 || resp.code === 504 || resp.code === 0) {
		return {status: 'unavailable', code: `${op}.unavailable`, localeKey: STATUS_LOCALE_KEYS.unavailable, retryable: true, ...common};
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
 * network-throw guarantee (a thrown fetch resolves to `unavailable`, it never
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
 */
export function fromThrownError(op: string, error: unknown): OpResult<never> {
	const status = error instanceof ApiError ? error.status : undefined;
	if (typeof status !== 'number' || !Number.isFinite(status) || (status >= 200 && status < 300)) {
		return fromNetworkError(op, error);
	}
	const mapped = fromSimpleResponse<never>({code: status, data: null, message: (error as ApiError).message}, op);
	if (mapped.status !== 'invalid') return mapped;
	return {...mapped, status: 'failed', code: `${op}.failed`, localeKey: STATUS_LOCALE_KEYS.failed};
}

/** A thrown fetch (network refusal, DNS, timeout) — there was no HTTP response at all. */
export function fromNetworkError(op: string, error?: unknown): OpResult<never> {
	return {
		status: 'unavailable',
		code: `${op}.network_error`,
		localeKey: STATUS_LOCALE_KEYS.unavailable,
		retryable: true,
		rawDetail: error instanceof Error ? error.message : undefined,
	};
}

