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
/** Only ever answered to a read that named a model (`?model_name=`). */
export const REASON_KV_EXACT_TOKENIZER_UNLOADABLE = 'KV_EXACT_TOKENIZER_UNLOADABLE';

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

//---------------------------------------------------------
// kv_exact_vllm for ONE model — the tokenizer half
//---------------------------------------------------------
// Asked with a model name, the gateway also runs the tokenizer check that rule
// admission runs: can a tokenizer for that model be loaded right now. It is a
// per-model artifact staged on the gateway, so no request body can supply it.
//
// ⚠️ A warning, never a block. A tokenizer can be staged after the read, and
// nothing tells the UI when that happens; the 412 on submit stays the answer.

export interface KvExactModelNotice {
	reasonCode: string;
	/** The gateway's sentence; may be empty. */
	reason: string;
}

/**
 * What the rule form says about the model it currently holds, or `null` to
 * say nothing.
 *
 * @param seed        the model-independent verdict. When it already refuses,
 *                    the form says so once; the model read repeats that reason.
 * @param model       the verdict read for `askedName`.
 * @param askedName   the model name the verdict was read for.
 * @param currentName the model name in the form now.
 */
export function kvExactModelNotice(seed: CapabilityVerdict, model: CapabilityVerdict, askedName: string, currentName: string): KvExactModelNotice | null {
	// ⭐ An answer about another name says nothing about this one: the operator
	// kept typing after the read was issued.
	if (!askedName || askedName !== currentName) return null;
	if (seed.kind === 'not-ready') return null;
	if (model.kind !== 'not-ready') return null;
	return {reasonCode: model.reasonCode, reason: model.reason};
}

//---------------------------------------------------------
// lb_allowed_sources — the source-check slot budget
//---------------------------------------------------------
// The gateway runs its admission predicate (LbSourceCheckPrecondition) on the
// slot the allocator would hand out NEXT, so `ready` answers exactly one
// question: can the next rule CREATED carry allowedSources. `limit`/`in_use`
// are the budget (slots 0..limit-1; freed slots are reused first).
//
// ⚠️ It says NOTHING about an existing rule: a PATCH adding allowedSources
// depends on THAT rule's slot, which the UI cannot see. So an edit never reads
// it, and the 412 on the edit path stays the only answer there.
//
// ⚠️ A warning, never a block. The verdict is a cached read and another
// operator or the CLI can free a slot after it was taken; a false block has no
// way out, while a false allow costs one 412 that already carries the
// gateway's sentence.
export const CAP_LB_ALLOWED_SOURCES = 'lb_allowed_sources';
export const REASON_LB_SOURCE_CHECK_SLOTS_EXHAUSTED = 'LB_SOURCE_CHECK_SLOTS_EXHAUSTED';
export const REASON_LB_RULES_UNAVAILABLE = 'LB_RULES_UNAVAILABLE';

export interface ICapabilityBudget {
	limit: number;
	inUse: number;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * A capability's budget, only when BOTH halves are present and sane. A missing
 * or garbled field is `undefined` — never 0, which would claim a budget the
 * gateway did not report.
 */
export function capabilityBudget(list: ICapabilityStatus[] | null | undefined, name: string): ICapabilityBudget | undefined {
	const entry = list?.find(c => c?.name === name);
	if (!entry || !isCount(entry.limit) || !isCount(entry.in_use)) return undefined;
	return {limit: entry.limit, inUse: entry.in_use};
}

export type SourceBudgetNotice =
	| {kind: 'none'}
	/** How many slots the next rules can still take. */
	| {kind: 'caption'; free: number; limit: number}
	/** The next rule cannot carry sources; `reason` is the gateway's sentence (may be empty). */
	| {kind: 'warning'; reasonCode: string; reason: string};

/**
 * What the LB CREATE form says about allowed sources. `unknown` says nothing:
 * the form behaves as it did before the gateway reported a budget.
 */
export function lbSourceBudgetNotice(list: ICapabilityStatus[] | null | undefined, hasSources: boolean): SourceBudgetNotice {
	const verdict = capabilityVerdict(list, CAP_LB_ALLOWED_SOURCES);
	if (verdict.kind === 'not-ready') {
		// Only worth saying to someone about to use a slot.
		return hasSources ? {kind: 'warning', reasonCode: verdict.reasonCode, reason: verdict.reason} : {kind: 'none'};
	}
	if (verdict.kind !== 'ready') return {kind: 'none'};
	const budget = capabilityBudget(list, CAP_LB_ALLOWED_SOURCES);
	if (!budget) return {kind: 'none'};
	return {kind: 'caption', free: Math.max(0, budget.limit - budget.inUse), limit: budget.limit};
}
