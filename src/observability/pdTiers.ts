//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IServiceConfiguration} from 'types/load_balancer';
import {IMetricsSnapshot} from 'types/observability';
import {RateResult, RatioResult, ratioOf} from './rates';
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
// endpoint with a cold cache. The share of selections landing there is what
// this panel exists to report.
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
const MODEL = 'model';

/**
 * The four tier label values, verified at the collector rather than copied
 * from the manifest: `RecordPDTierSelected` (api/prometheus/ai_metrics.go)
 * maps the datapath's integer tier through a `switch` whose `default` arm
 * RETURNS WITHOUT RECORDING, and the C datapath's four call sites
 * (loxilb-ebpf/common/sockproxy_pd.c) pass the literals 0, 1, 15 and 2.
 *
 * ⭐ The label set is therefore CLOSED: an unrecognised tier cannot appear in
 * the exposition, because the Go switch drops it before it becomes a series.
 * That is why this module has no "unknown tier" row — it would be a state the
 * contract makes unreachable. The cost of that design lands elsewhere: a tier
 * the datapath adds without the Go switch learning it increments nothing at
 * all, which is invisible in this family and is exactly what the reconciliation
 * below is for.
 */
export const PD_TIERS = ['tier0', 'tier1', 'tier15', 'tier2'] as const;
export type PDTier = (typeof PD_TIERS)[number];

/** Tier 2 is the no-affinity fallback; the other three all reuse a warm endpoint. */
export const PD_FALLBACK_TIER: PDTier = 'tier2';

//---------------------------------------------------------
// What configuration makes a tier reachable
//---------------------------------------------------------
// ⚠️ The metric is gateway-global (labelled by model, never by rule), so a
// gate is answered for the GATEWAY: "can any rule here select this tier".
// With one cache-aware rule and one plain P/D rule beside it, both tier1 and
// tier2 selections are expected and neither is attributable to a rule. The
// panel says "reachable", not "enabled for this traffic", for that reason.

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

/** Whether `tier` can be selected at all under `gates`. `undefined` gates ⇒ unknown. */
export function tierReachable(tier: PDTier, gates: IPDTierGates | undefined): boolean | undefined {
	if (!gates) return undefined;
	if (!gates.pdDisagg) return false;
	switch (tier) {
		case 'tier1':
			return gates.cacheAware;
		case 'tier15':
			return gates.kvExact;
		// Tier-0 session stickiness applies to P/D routing whenever a client
		// session key is present, independently of pd_cache_aware_mode (the
		// vendored `pd_session_ttl_sec` description says so explicitly), and
		// Tier-2 is the unconditional fallback. Both are reachable on any P/D
		// rule.
		case 'tier0':
		case 'tier2':
			return true;
	}
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

export interface IPDTierRow {
	tier: PDTier;
	/** Selections per second across the observed window. */
	rate: RateResult;
	/** This tier's share of all selections in the same window. */
	share: RatioResult;
	/** Lifetime selections at this tier, summed over models. */
	total: number | undefined;
	/**
	 * Whether configuration permits this tier at all; `undefined` when the
	 * rule list was unavailable. A zero at an unreachable tier is expected
	 * and must not read as a fault.
	 */
	reachable: boolean | undefined;
}

export interface IPDModelRow {
	/** The metric label. ⚠️ "other" is the 64-model overflow bucket, not a model. */
	model: string;
	total: number | undefined;
	/** Share of this model's selections that reused a warm endpoint. */
	affinityShare: RatioResult;
	fallbackRate: RateResult;
}

/**
 * What the mix says about cache-aware routing, as one verdict so no renderer
 * re-derives it and gets the configured case backwards.
 */
export type AffinityVerdict =
	// No selections in the window. 0/0 asserts nothing about affinity.
	| 'no-traffic'
	// The rule list was unavailable, so "expected" cannot be distinguished
	// from "broken". The mix is still shown; the judgement is withheld.
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
			tiers: readonly IPDTierRow[];
			/** All selections, every tier and model. */
			totalRate: RateResult;
			/** Share reusing a warm endpoint — every tier except the min-load fallback. */
			affinityShare: RatioResult;
			verdict: AffinityVerdict;
			byModel: readonly IPDModelRow[];
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
	// failed. Presence, lifetime totals and the row set come from the
	// snapshot — only rates need the pair, and with one observation they
	// correctly say "warming up".
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	if (!snapshot.families.get(PD_TIER_SELECTED)) return {kind: 'not-exported'};

	// ⚠️ `partitionRate`, not `familySumRate`, for every tier. A counter child
	// exists only once incremented, so a tier the ladder has never terminated
	// at exports no series — and on a family that IS present that is a
	// genuine 0/s, not an unknown. `familySumRate` would answer
	// insufficient-samples and print "Warming up…" forever at exactly the
	// tiers whose emptiness is the finding.
	const tierRate = (tier: PDTier) => partitionRate(history, PD_TIER_SELECTED, maxGapMs, {[TIER]: tier});
	const totalRate = partitionRate(history, PD_TIER_SELECTED, maxGapMs, () => true);
	// The complement of the fallback rather than a sum of the other three:
	// one predicate is one summed series and therefore one rate, where
	// summing three would report insufficient-samples for the whole answer
	// the first time any single tier appeared.
	const affinityRate = partitionRate(history, PD_TIER_SELECTED, maxGapMs, l => l[TIER] !== PD_FALLBACK_TIER);
	const affinityShare = ratioOf(affinityRate, totalRate);

	const tiers = PD_TIERS.map<IPDTierRow>(tier => {
		const rate = tierRate(tier);
		return {
			tier,
			rate,
			share: ratioOf(rate, totalRate),
			total: lifetimeSum(snapshot, PD_TIER_SELECTED, l => l[TIER] === tier),
			reachable: tierReachable(tier, gates),
		};
	});

	// Rows come from the snapshot's own label values, not from REST. The
	// question "which models took P/D traffic" is answerable only by the
	// traffic: a rule's configured `model_name` is a different set, and the
	// label may be the "other" overflow bucket or the empty string (the
	// datapath passes "" for model-less traffic) — neither of which any REST
	// field can produce. Pattern-4's REST-first rule still governs the
	// VERDICT, which is where a wrong guess would misinform an operator.
	const models = new Set<string>();
	for (const s of selectSamples(snapshot, PD_TIER_SELECTED)) models.add(s.labels[MODEL] ?? '');

	const byModel = [...models]
		.map<IPDModelRow>(model => {
			// ⚠️ A predicate, not label equality, and the same one the row key
			// and the lifetime total use. Label equality never matches a
			// sample that OMITS the label, while `?? ''` groups it under the
			// empty-model row — so the equality form would have given that one
			// row a lifetime total with no rate beside it. The gateway does
			// emit `model=""` for model-less traffic, so the row is real.
			const isModel = (l: Readonly<Record<string, string>>) => (l[MODEL] ?? '') === model;
			const all = partitionRate(history, PD_TIER_SELECTED, maxGapMs, isModel);
			const affinity = partitionRate(history, PD_TIER_SELECTED, maxGapMs, l => isModel(l) && l[TIER] !== PD_FALLBACK_TIER);
			return {
				model,
				total: lifetimeSum(snapshot, PD_TIER_SELECTED, isModel),
				affinityShare: ratioOf(affinity, all),
				fallbackRate: partitionRate(history, PD_TIER_SELECTED, maxGapMs, l => isModel(l) && l[TIER] === PD_FALLBACK_TIER),
			};
		})
		// Busiest model first, with lifetime total as the tiebreak so the
		// table does not reshuffle between polls.
		.sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.model.localeCompare(b.model));

	return {
		kind: 'ok',
		tiers,
		totalRate,
		affinityShare,
		verdict: affinityVerdict(affinityShare, gates),
		byModel,
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
