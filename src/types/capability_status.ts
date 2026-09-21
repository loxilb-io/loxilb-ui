//---------------------------------------------------------
// Gateway runtime capability readiness (GET /status/capabilities)
//---------------------------------------------------------
// A capability here is a feature whose availability is decided by the
// GATEWAY'S LAUNCH ENVIRONMENT, not by anything a request carries. The
// gateway's own words: "A capability reported not ready refuses every attempt
// to use it with 412 and the reason carried here, whatever the client sends."
//
// ⚠️⚠️ WHY THIS IS NOT THE CAPABILITY MAP, AND NOT `IKvExactStatusEntry`.
// Three different questions wear the word "capability" in this repo, and
// conflating any two of them produces a control that lies:
//
//   api/capabilities.ts (spec-derived)  does this BUILD's API have the field?
//   this module          (runtime)      can this DEPLOYMENT serve the feature?
//   ai_gateway.ts KvExactReadiness      is enforcement live on ONE rule?
//
// The first is static and answered by the vendored contract. The second can
// only be asked of the running gateway, changes when someone restarts it with
// a different environment, and is what decides whether a control can succeed.
// The third is per-rule telemetry and says nothing about admission.
//
// ⭐⭐ UNKNOWN IS NOT "NOT READY" — the single rule this module exists to keep.
// Absence of a capability from the list means, per the contract, "this build
// does not know it", and an older gateway answers 404 for the whole endpoint.
// Neither is evidence that the feature is unavailable. Treating them as "not
// ready" would hide a working feature behind a control we disabled on a guess
// — the same fail-narrow mistake in the opposite direction from the one this
// endpoint was added to fix. So absence reads `unknown`, and every consumer
// treats `unknown` exactly as it treated the world before the endpoint
// existed: offer the control, let the gateway answer.

import type {GwSchema} from 'api';

export type ICapabilityStatus = GwSchema<'CapabilityStatus'>;

/**
 * Stable capability identifier. Deliberately a plain string in the contract
 * ("a build that gains a capability must not become unparseable to an older
 * client"), so this is a known-value constant, never an exhaustive union.
 */
export const CAP_KV_EXACT_VLLM = 'kv_exact_vllm';

/**
 * Stable reason codes, for branching without matching prose. Append-only on
 * the gateway side; an unrecognised code is still a refusal — it just has to
 * be explained in the gateway's own sentence rather than ours.
 */
export const REASON_KV_EXACT_SEED_UNSET = 'KV_EXACT_SEED_UNSET';
export const REASON_KV_EXACT_SEED_TOO_LONG = 'KV_EXACT_SEED_TOO_LONG';

export type CapabilityVerdict =
	/** The gateway can admit use of this capability right now. */
	| {kind: 'ready'}
	/**
	 * Every attempt is refused with 412 until the DEPLOYMENT changes. `reason`
	 * is the gateway's operator-facing sentence — it names the setting and the
	 * required relationship, which is the only actionable part — and is empty
	 * only if the gateway omitted it (both fields are optional in the schema).
	 */
	| {kind: 'not-ready'; reasonCode: string; reason: string}
	/**
	 * We do not know. `endpoint-absent`: the gateway predates the capability
	 * surface (404). `not-listed`: the surface answered, but this build does
	 * not know this capability. `unreadable`: the read failed for any other
	 * reason (transport, auth, a malformed body).
	 */
	| {kind: 'unknown'; why: 'endpoint-absent' | 'not-listed' | 'unreadable'};

/**
 * Read one capability's verdict out of a capability list.
 *
 * @param list the parsed `capabilities` array, `null` when the endpoint is
 *             absent (404 — an older gateway), `undefined` while unread.
 */
export function capabilityVerdict(list: ICapabilityStatus[] | null | undefined, name: string): CapabilityVerdict {
	if (list === null) return {kind: 'unknown', why: 'endpoint-absent'};
	if (list === undefined) return {kind: 'unknown', why: 'unreadable'};
	const entry = list.find(c => c?.name === name);
	if (!entry) return {kind: 'unknown', why: 'not-listed'};
	// ⚠️ `ready` is required by the schema, so a non-boolean here is a
	// malformed body rather than a verdict. Reading a missing/garbled `ready`
	// as false would invent a refusal the gateway never made.
	if (typeof entry.ready !== 'boolean') return {kind: 'unknown', why: 'unreadable'};
	if (entry.ready) return {kind: 'ready'};
	return {
		kind: 'not-ready',
		reasonCode: typeof entry.reason_code === 'string' ? entry.reason_code : '',
		reason: typeof entry.reason === 'string' ? entry.reason.trim() : '',
	};
}

/** Convenience: the vLLM KV-exact admission verdict. */
export function kvExactVllmVerdict(list: ICapabilityStatus[] | null | undefined): CapabilityVerdict {
	return capabilityVerdict(list, CAP_KV_EXACT_VLLM);
}

/**
 * Should a KV-exact control be offered at all?
 *
 * ⭐ `unknown` offers it. See the header: the only state that withdraws a
 * control is a gateway that positively said it will refuse.
 */
export function kvExactAdmissible(verdict: CapabilityVerdict): boolean {
	return verdict.kind !== 'not-ready';
}
