//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IServiceConfiguration} from 'types/load_balancer';
import {IMetricsSnapshot} from 'types/observability';
import {RatioResult, ratioOf} from './rates';
import {selectSamples} from './selectors';
import {partitionRate} from './snapshotRates';

//---------------------------------------------------------
// P/D prefill routing tier mix (Stage 3.2)
//---------------------------------------------------------
// `loxilb_ai_pd_tier_selected_total{tier,model}` counts the TERMINAL routing
// decision for every successful prefill selection, exactly once. Four tiers,
// tried in ladder order, each cheaper for the inference plane than the next:
//
//   tier0   session stickiness — the request reuses the endpoint pair its
//           session key is already pinned to
//   tier1   trie prefix affinity — a shared system-prompt prefix routes to
//           the endpoint that already holds it
//   tier15  KV-exact — the exact KV blocks this request needs are known to
//           live on a specific endpoint
//   tier2   min-load — no affinity was available, so pick the least loaded
//
// So tier2 is the fallback: it serves the request correctly, but on an
// endpoint with a cold cache. The page reports one verdict on the share that
// reused a warm endpoint; the per-tier and per-model breakdown is Grafana's
// ("P/D routing tier mix").
//
// ⭐⭐ The trap it exists to AVOID, and the direct analogue of the JWKS
// last-known-good case in Stage 3.1: **a 100% tier2 mix is frequently the
// CORRECT and configured behaviour, not a fault.** tier1 is reachable only
// with `pd_cache_aware_mode` on some rule, tier15 only with `kvExactMode: 1`.
// With those gates closed the datapath never even attempts them, and painting
// a tier2-dominant mix as a cache-routing failure would report a problem on a
// gateway doing precisely what it was told. The gates come from REST, so the
// panel can tell "not configured" apart from "configured and not working" —
// and only the second is a finding.

export const PD_TIER_SELECTED = 'loxilb_ai_pd_tier_selected_total';
// The pre-existing Tier-0 counter. The manifest requires it to reconcile with
// the tier family for one release; `tier0Reconciliation` is that check.
export const PD_SESSION_HITS = 'loxilb_ai_pd_session_hits_total';

const TIER = 'tier';

/** Tier 2 is the no-affinity fallback; the other three all reuse a warm endpoint. */
export const PD_FALLBACK_TIER = 'tier2';

//---------------------------------------------------------
// What configuration makes a tier reachable
//---------------------------------------------------------
// ⚠️ The metric is gateway-global (labelled by model, never by rule), so a
// gate is answered for the GATEWAY: "can any rule here select this tier".
// With one cache-aware rule and one plain P/D rule beside it, both tier1 and
// tier2 selections are expected and neither is attributable to a rule.

export interface IPDTierGates {
	/** Some rule runs P/D disaggregation at all — without this nothing here ever increments. */
	pdDisagg: boolean;
	/** Some rule sets `pd_cache_aware_mode`, the gate on Tier-1 trie affinity. */
	cacheAware: boolean;
	/** Some rule sets `kvExactMode: 1`, the gate on Tier-1.5 KV-exact routing. */
	kvExact: boolean;
}

// kvExactMode 3 is deliberately NOT a Tier-1.5 gate: the vendored contract
// rule LB-EXACT-SINGLE-POOL requires fullproxy and PROHIBITS P/D
// orchestration, so a mode-3 rule produces no P/D tier selections at all.
const KV_EXACT_PD_MODE = 1;

/**
 * Which tiers this gateway's configuration can reach.
 *
 * Returns `undefined` when the rule list is not available — a distinct answer
 * from "no gates open". Without the configuration the panel cannot say whether
 * a zero is expected, and guessing would put it right back into the failure
 * mode this design avoids.
 */
export function pdTierGates(rules: readonly IServiceConfiguration[] | undefined): IPDTierGates | undefined {
	if (!rules) return undefined;
	const gates: IPDTierGates = {pdDisagg: false, cacheAware: false, kvExact: false};
	for (const rule of rules) {
		const args = rule.serviceArguments;
		if (!args?.pd_disagg_mode) continue;
		gates.pdDisagg = true;
		// Both of these require pd_disagg_mode upstream (LB-CACHE-REQUIRES-PD,
		// LB-EXACT-PD-MODE), so reading them only inside this branch mirrors
		// the contract instead of trusting the field in isolation.
		if (args.pd_cache_aware_mode) gates.cacheAware = true;
		if (args.kvExactMode === KV_EXACT_PD_MODE) gates.kvExact = true;
	}
	return gates;
}

//---------------------------------------------------------
// Tier-0 reconciliation — the in-page cross-check
//---------------------------------------------------------
// ⭐ The manifest asks consumers to reconcile the pre-existing Tier-0 counter
// with this family, and the two writers are provably one-to-one:
// `llb_ai_pd_session_hit(...)` and `pd_record_tier_selected(pfe, 0)` are
// CONSECUTIVE STATEMENTS at the single Tier-0 terminal return
// (sockproxy_pd.c), both behind the same build guard, both resolving the model
// through the same fallback ladder, and each has exactly one call site. So the
// two counters increment together, from zero, for the life of the process.
//
// ⭐ That makes the check LIFETIME EQUALITY rather than a rate comparison: it
// needs one snapshot instead of a pair, has no warm-up window, and compares
// integers instead of quotients. A windowed form would have been strictly
// weaker for no benefit.
//
// ⚠️ It compares TOTALS, summed over models, deliberately. Both families
// label with `boundModelLabel`, which collapses every model past the 64th to
// the literal "other"; if the registry filled between the two adjacent calls
// the per-model split could differ by one while the total still held. The
// total is invariant to label bucketing, so it is the form that only fires on
// a real writer defect.
//
// ⚠️ And what a mismatch MEANS is narrow: one of the two writers is dropping
// increments. It is not a traffic problem and not an operator's
// misconfiguration, so the panel reports it as a data-trust caveat on the
// mix, never as an incident.

export type Tier0Reconciliation =
	// One of the two families is absent, so there is nothing to compare. The
	// expected reading on a gateway that has taken no Tier-0 selection.
	| {kind: 'not-comparable'}
	| {kind: 'agrees'; selections: number}
	| {kind: 'disagrees'; tierSelections: number; sessionHits: number};

/** Lifetime sum of a family's finite samples, or undefined when it reports nothing. */
function lifetimeSum(snapshot: IMetricsSnapshot, family: string, where?: (labels: Readonly<Record<string, string>>) => boolean): number | undefined {
	if (!snapshot.families.get(family)) return undefined;
	let total = 0;
	let seen = false;
	for (const s of selectSamples(snapshot, family)) {
		if (where && !where(s.labels)) continue;
		// A non-finite counter is not a count. Skipping it keeps the sum from
		// becoming NaN and silently turning the reconciliation into a mismatch.
		if (!Number.isFinite(s.value)) continue;
		total += s.value;
		seen = true;
	}
	return seen ? total : undefined;
}

export function tier0Reconciliation(snapshot: IMetricsSnapshot | undefined): Tier0Reconciliation {
	if (!snapshot || snapshot.failure) return {kind: 'not-comparable'};
	const tierSelections = lifetimeSum(snapshot, PD_TIER_SELECTED, l => l[TIER] === 'tier0');
	const sessionHits = lifetimeSum(snapshot, PD_SESSION_HITS);
	if (tierSelections === undefined || sessionHits === undefined) return {kind: 'not-comparable'};
	return tierSelections === sessionHits
		? {kind: 'agrees', selections: tierSelections}
		: {kind: 'disagrees', tierSelections, sessionHits};
}

//---------------------------------------------------------
// The mix
//---------------------------------------------------------

/**
 * What the mix says about cache-aware routing, as one verdict so no renderer
 * re-derives it and gets the configured case backwards.
 */
export type AffinityVerdict =
	// No selections in the window. 0/0 asserts nothing about affinity.
	| 'no-traffic'
	// The rule list was unavailable, so "expected" cannot be distinguished
	// from "broken". The judgement is withheld.
	| 'unknown-configuration'
	// ⭐ Neither affinity gate is open. A tier2-dominant mix IS the configured
	// behaviour here and is not a finding.
	| 'as-configured'
	// An affinity gate is open and selections are reaching it.
	| 'reuse-working'
	// ⭐⭐ The one actionable state: cache-aware or KV-exact routing is
	// configured, traffic is flowing, and NOTHING is reaching those tiers.
	// The gateway is paying for affinity machinery that is placing nothing.
	| 'configured-no-reuse';

export type PDTierMixReport =
	// No snapshot, or the scrape did not answer. Nothing is known.
	| {kind: 'unavailable'}
	// ⚠️ The family is absent. The EXPECTED reading until a P/D rule takes AI
	// traffic — a precondition, never an error. Callers separate "no P/D rule
	// configured" from "configured but idle" using the gates.
	| {kind: 'not-exported'}
	| {
			kind: 'ok';
			/** Share reusing a warm endpoint — every tier except the min-load fallback. */
			affinityShare: RatioResult;
			verdict: AffinityVerdict;
			reconciliation: Tier0Reconciliation;
		};

export function pdTierMix(
	snapshot: IMetricsSnapshot | undefined,
	history: readonly IMetricsSnapshot[],
	maxGapMs: number,
	gates: IPDTierGates | undefined,
): PDTierMixReport {
	// ⚠️ The CURRENT snapshot is passed separately from the rate history and
	// is never read off its tail. The retention ring is filled in an effect,
	// so a page legitimately holds a snapshot while `history` is still empty;
	// reading the tail there answers "unavailable", which claims the scrape
	// failed. Presence comes from the snapshot — only the share needs the
	// pair, and with one observation it correctly says "warming up".
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	if (!snapshot.families.get(PD_TIER_SELECTED)) return {kind: 'not-exported'};

	// ⚠️ `partitionRate`, not `familySumRate`. A counter child exists only
	// once incremented, so the affinity tiers export no series until the
	// ladder first terminates there — and on a family that IS present that is
	// a genuine 0/s, not an unknown. `familySumRate` would answer
	// insufficient-samples and withhold the verdict forever at exactly the
	// state (`configured-no-reuse`) whose emptiness is the finding.
	const totalRate = partitionRate(history, PD_TIER_SELECTED, maxGapMs, () => true);
	// The complement of the fallback rather than a sum of the other three:
	// one predicate is one summed series and therefore one rate, where
	// summing three would report insufficient-samples for the whole answer
	// the first time any single tier appeared.
	const affinityRate = partitionRate(history, PD_TIER_SELECTED, maxGapMs, l => l[TIER] !== PD_FALLBACK_TIER);
	const affinityShare = ratioOf(affinityRate, totalRate);

	return {
		kind: 'ok',
		affinityShare,
		verdict: affinityVerdict(affinityShare, gates),
		reconciliation: tier0Reconciliation(snapshot),
	};
}

export function affinityVerdict(affinityShare: RatioResult, gates: IPDTierGates | undefined): AffinityVerdict {
	// Order matters. "No traffic" and "unknown configuration" both mean the
	// question was not answered, and either one must win over a verdict that
	// would read as a measurement.
	if (affinityShare.kind === 'no-traffic') return 'no-traffic';
	if (!gates) return 'unknown-configuration';
	// ⭐ Neither affinity gate open ⇒ the datapath never attempts Tier-1 or
	// Tier-1.5, so whatever Tier-0 achieves is all the affinity there is to
	// have. Nothing here is a finding.
	if (!gates.cacheAware && !gates.kvExact) return 'as-configured';
	// A share that cannot be derived qualifies the verdict; it never
	// manufactures the bad one.
	if (affinityShare.kind !== 'ok') return 'unknown-configuration';
	return affinityShare.ratio > 0 ? 'reuse-working' : 'configured-no-reuse';
}
