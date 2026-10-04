//---------------------------------------------------------
// The KV-exact readiness DECISION, separated from the fetch.
//---------------------------------------------------------
// This is the gate that decides whether the KV-exact specs run at all. A
// defect here does not turn a run red — it turns it green with fewer tests,
// which is the one failure mode a test suite cannot report on itself. So the
// decision lives here, pure and free of any I/O, and is driven directly by
// e2e/selftest/kvExactReadiness.spec.ts (cases A-01..A-12).
//
// ⚠️ This module must stay importable with NO environment: e2e/helpers/api.ts
// throws at module load when E2E_OAM_URL is unset, and the 'selftest' project
// is defined as "no app, no testbed, no auth". Keep it dependency-free.
//
// api.ts owns the fetching and delegates the verdict here.

export interface KvExactReadiness {
	ready: boolean;
	reason: string;
}

/** `kv_exact_vllm` — the capability name the gateway publishes for vLLM KV-exact admission. */
export const CAP_KV_EXACT_VLLM = 'kv_exact_vllm';

interface CapabilityEntry {
	name?: string;
	ready?: boolean;
	reason?: string;
	reason_code?: string;
}

/**
 * Decide from a `GET /status/capabilities` response.
 *
 * ⭐ `null` means "this gateway did not answer the question" — an older build
 * with no such endpoint, a body we cannot read, or a list that does not carry
 * the capability. The contract defines an absent capability as "this build
 * does not know it", NOT as "not ready", so every one of those falls through
 * to the legacy write probe rather than inventing a refusal.
 */
export function kvExactVerdictFromCapabilities(status: number, bodyText: string): KvExactReadiness | null {
	if (status < 200 || status >= 300) return null;

	let body: unknown;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return null;
	}
	// A body that is valid JSON but not an object (`null`, a bare array, a
	// number) is as unreadable as no body at all — and reading `.capabilities`
	// off `null` would throw rather than fall through.
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;

	const list = (body as {capabilities?: unknown}).capabilities;
	if (!Array.isArray(list)) return null;

	const entry = (list as CapabilityEntry[]).find(c => c?.name === CAP_KV_EXACT_VLLM);
	// `ready` is required upstream, so a non-boolean is a malformed body rather
	// than a verdict — fall through rather than invent a refusal.
	if (!entry || typeof entry.ready !== 'boolean') return null;

	if (entry.ready) return {ready: true, reason: 'Gateway reports KV-exact readiness'};
	const reason = (entry.reason ?? '').trim() || `reason_code=${entry.reason_code ?? 'unspecified'}`;
	return {ready: false, reason: `Gateway reports KV-exact not ready: ${reason}`};
}

/**
 * Decide from a refused write probe — the LEGACY path, reached only on a
 * gateway with no capability surface.
 *
 * ⭐⭐ THE SAFETY PROPERTY: only a refusal that is positively about the
 * server's launch environment yields `ready: false`. A 412 says so
 * structurally. A 400 whose text names a launch-environment precondition says
 * so by string match — the old, fragile road. Anything else — any other 400,
 * any other status — returns `ready: true` so the spec RUNS and fails loudly,
 * because a gate that swallowed unrecognised errors would hide the very UI
 * regressions it sits in front of.
 */
export function kvExactVerdictFromRefusal(status: number, bodyText: string): KvExactReadiness {
	let detail = bodyText;
	try {
		detail = (JSON.parse(bodyText) as {result?: string}).result ?? bodyText;
	} catch {
		/* keep the raw text */
	}

	// 412 Precondition Failed: the gateway itself classified this as being about
	// its own launch environment. No string matching needed or wanted.
	if (status === 412) {
		return {ready: false, reason: `Gateway refused a KV-exact rule as a server precondition: ${detail}`};
	}

	// Matched against the RAW body, not the unwrapped detail: on a build that
	// does not wrap its errors in `{result}` the variable name is only in the
	// raw text.
	const namesPrecondition = /LLB_KV_NONE_HASH_SEED|PYTHONHASHSEED|tokenizer/i.test(bodyText);
	if (status === 400 && namesPrecondition) {
		return {ready: false, reason: `Gateway is not launched for KV-exact routing: ${detail}`};
	}

	return {ready: true, reason: `KV-exact readiness probe answered HTTP ${status}`};
}
