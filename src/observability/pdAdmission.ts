//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {RateResult} from './rates';
import {selectScalar} from './selectors';
import {familySumRate} from './snapshotRates';

//---------------------------------------------------------
// P/D per-EP admission pressure (Stage 3.4)
//---------------------------------------------------------
// The per-EP admission layer is what the gateway does when every healthy
// prefill endpoint is already at its in-flight cap. One entry condition, then
// a fork chosen by a single runtime bound:
//
//   healthy_elig > 0 && under_cap == 0          (all healthy prefill EPs full)
//     depth == 0  -> pd_admission_shed_total++          -> 429 pd_overloaded
//     depth >  0  -> park on the shortest FIFO under the bound
//                      -> pd_admission_queued_total++   -> HELD, not dropped
//                    every eligible FIFO also full
//                      -> pd_admission_overflow_shed_total++ -> 429 pd_overloaded
//
// (`sockproxy_pd.c`, the `pd_queue_depth_per_ep()` fork.)
//
// ⭐⭐ THE DEFECT THIS PANEL EXISTS TO REMOVE, and it is a defect in OUR page
// rather than in the gateway. `PdKvPage` rendered one row — "Admission shed",
// reading `loxilb_pd_admission_shed_total` alone. But `depth` is resolved by
// `getenv("LLB_PD_QUEUE_DEPTH_PER_EP")` into a **process-cached static**, so
// on a queueing deployment (`depth > 0`) the plain-shed branch is
// **structurally unreachable** and that counter is pinned at 0 for the life of
// the process — while the overflow valve drops requests and clients receive
// 429s. The page therefore reported "shed 0/s" during an active overload that
// was dropping traffic. This is the same blind spot the gateway closed on its
// export side when it added the overflow family; the UI still had it on the
// read side.
//
// ⚠️⚠️ **Pattern 5 CANNOT be applied here, and that is what makes this stage
// different from 3.2 and 3.3.** Both of those could ask REST what a zero was
// supposed to look like — a rule's gate fields, a policy list. This gate is
// `getenv`-only and cached once, exposed by **no REST surface at all**, so
// there is no configuration to consult. The honest substitute is to infer the
// armed branch from the metrics themselves, and to say "indeterminate" when
// they cannot answer rather than guessing:
//
//   queued > 0 or overflow > 0  ⇒ depth > 0  ⇒ plain shed UNREACHABLE
//   shed > 0                    ⇒ depth == 0 ⇒ overflow  UNREACHABLE
//   all three zero              ⇒ the gate is INVISIBLE from here
//
// Only the first two are conclusive, and each is conclusive because the
// branches are mutually exclusive for the whole process lifetime.
//
// ⭐ All three are unlabelled `promauto.NewCounter`s registered at package
// init (`api/prometheus/sockproxy_metrics.go`), so they export `0` from
// process start unconditionally — confirmed on the live gateway. A zero here
// is therefore a REAL zero, not an absent child, which is why this module has
// no lazy-child reasoning and why `familySumRate` (not `partitionRate`) is the
// right rate helper. The one absence that IS meaningful is a build predating
// the overflow family: see `blindSpot`.

export const PD_ADMISSION_SHED = 'loxilb_pd_admission_shed_total';
export const PD_ADMISSION_OVERFLOW_SHED = 'loxilb_pd_admission_overflow_shed_total';
export const PD_ADMISSION_QUEUED = 'loxilb_pd_admission_queued_total';

/**
 * Which shed branch this gateway process can reach.
 *
 * ⚠️ A property of the PROCESS, not of a rule or of traffic: the depth is
 * read from the environment once and cached, so this cannot change until the
 * gateway restarts. A restart resets the counters, which correctly returns
 * this to `indeterminate` rather than carrying a stale inference forward.
 */
export type AdmissionMode =
	// ⭐ `depth > 0`, proven by a park or an overflow having happened. The
	// plain-shed counter is pinned at zero and must NOT be read as "no drops".
	| 'queueing'
	// `depth == 0`, proven by a plain shed having happened. The overflow valve
	// is unreachable and its zero is structural.
	| 'shedding'
	// Nothing has parked or shed yet, so the environment gate is invisible
	// from the metrics. Both zeros are honest but neither is informative about
	// which branch is armed.
	| 'indeterminate'
	// ⚠️ Impossible per the datapath: the two shed branches are mutually
	// exclusive for the process lifetime. Reported as a data-trust caveat.
	| 'contradictory';

/** What the admission layer is doing to requests, over this process's lifetime. */
export type AdmissionVerdict =
	// The prefill pool has never filled. Nothing to act on.
	| 'no-pressure'
	// ⭐ Requests have been PARKED and none dropped. Backpressure is working
	// exactly as designed — parking is hold-don't-drop, so this is NOT a fault
	// and must not be coloured as one.
	| 'absorbing'
	// ⭐⭐ The actionable state: requests were shed and the clients received
	// 429 `pd_overloaded`.
	| 'dropping';

export type PdAdmissionReport =
	// No snapshot, or the scrape itself failed.
	| {kind: 'unavailable'}
	// None of the three families is in the scrape: a build without the per-EP
	// admission layer, or a flavour that does not run P/D at all.
	| {kind: 'not-exported'}
	| {
			kind: 'ok';
			mode: AdmissionMode;
			verdict: AdmissionVerdict;
			/** Requests dropped per second — both valves, of which one is live. */
			dropRate: RateResult;
			/** Requests parked per second. Held, not lost. */
			queuedRate: RateResult;
			shedRate: RateResult;
			overflowRate: RateResult;
			/** Lifetime totals; `undefined` when the family is absent. */
			shedTotal: number | undefined;
			overflowTotal: number | undefined;
			queuedTotal: number | undefined;
			/** Lifetime drops across both valves; `undefined` when neither is readable. */
			dropTotal: number | undefined;
			/**
			 * ⚠️⚠️ The pre-overflow-family blind spot: queueing is proven ARMED while the
			 * overflow family is absent from the scrape, so the only shed this
			 * gateway can take is the one it does not export. Drops are
			 * happening invisibly. A monitoring fault, not a datapath one.
			 */
			blindSpot: boolean;
	  };

/**
 * Sum rates that must all be derivable.
 *
 * ⚠️ Treating an underivable term as zero would UNDERSTATE a drop count, and
 * understating drops is the dangerous direction — it is the same failure the
 * page had before this stage. So any non-`ok` term propagates instead.
 */
function sumRates(rates: readonly RateResult[]): RateResult {
	if (rates.length === 0) return {kind: 'insufficient-samples'};
	const notOk = rates.find(r => r.kind !== 'ok');
	if (notOk) return notOk;
	let perSecond = 0;
	let intervalMs = 0;
	for (const r of rates) {
		if (r.kind !== 'ok') continue;
		perSecond += r.perSecond;
		intervalMs = Math.max(intervalMs, r.intervalMs);
	}
	return {kind: 'ok', perSecond, intervalMs};
}

/**
 * Infer the armed branch from what has actually happened.
 *
 * Totals are LIFETIME counts, deliberately: the inference is about a
 * process-wide environment value, so any increment ever taken proves which
 * branch is live, and a windowed form would lose that proof as soon as the
 * traffic stopped.
 */
export function admissionMode(
	shedTotal: number | undefined,
	overflowTotal: number | undefined,
	queuedTotal: number | undefined,
): AdmissionMode {
	const shed = (shedTotal ?? 0) > 0;
	const queueing = (overflowTotal ?? 0) > 0 || (queuedTotal ?? 0) > 0;
	// ⚠️ Checked FIRST: a plain shed together with any queueing evidence
	// cannot happen in one process, so reporting either mode would assert
	// something the datapath forbids.
	if (shed && queueing) return 'contradictory';
	if (queueing) return 'queueing';
	if (shed) return 'shedding';
	return 'indeterminate';
}

/** Whether `family` can ever increment under `mode`. `undefined` ⇒ unknown. */
export function branchReachable(family: string, mode: AdmissionMode): boolean | undefined {
	if (mode === 'indeterminate' || mode === 'contradictory') return undefined;
	if (family === PD_ADMISSION_SHED) return mode === 'shedding';
	if (family === PD_ADMISSION_OVERFLOW_SHED || family === PD_ADMISSION_QUEUED) return mode === 'queueing';
	return undefined;
}

export function admissionVerdict(dropTotal: number | undefined, queuedTotal: number | undefined): AdmissionVerdict {
	// ⭐ Drops outrank parking. A gateway that parked a thousand requests and
	// dropped one has still dropped one, and that is the fact an operator
	// needs first.
	if ((dropTotal ?? 0) > 0) return 'dropping';
	if ((queuedTotal ?? 0) > 0) return 'absorbing';
	return 'no-pressure';
}

export function pdAdmission(
	snapshot: IMetricsSnapshot | undefined,
	history: readonly IMetricsSnapshot[],
	maxGapMs: number,
): PdAdmissionReport {
	// ⚠️ The CURRENT snapshot is read separately from the rate history and is
	// never taken off its tail — the retention ring is filled in an effect, so
	// a page legitimately holds a snapshot while `history` is still empty.
	// Presence and lifetime totals come from the snapshot; only rates need the
	// pair, and with one observation they correctly say "warming up".
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};

	const shedExported = snapshot.families.get(PD_ADMISSION_SHED) !== undefined;
	const overflowExported = snapshot.families.get(PD_ADMISSION_OVERFLOW_SHED) !== undefined;
	const queuedExported = snapshot.families.get(PD_ADMISSION_QUEUED) !== undefined;
	if (!shedExported && !overflowExported && !queuedExported) return {kind: 'not-exported'};

	// ⭐ `selectScalar`, not a sum: these are unlabelled single-series
	// counters, and if a future gateway gave one of them labels this reads as
	// absent rather than silently reporting a wrong total.
	const shedTotal = selectScalar(snapshot, PD_ADMISSION_SHED);
	const overflowTotal = selectScalar(snapshot, PD_ADMISSION_OVERFLOW_SHED);
	const queuedTotal = selectScalar(snapshot, PD_ADMISSION_QUEUED);

	const mode = admissionMode(shedTotal, overflowTotal, queuedTotal);

	// Lifetime drops span BOTH valves. Exactly one can be non-zero, so the sum
	// is the right headline under every mode — including `indeterminate`,
	// where it is zero either way, and `contradictory`, where reporting one
	// branch alone would hide half the drops.
	const dropTotal =
		shedTotal === undefined && overflowTotal === undefined ? undefined : (shedTotal ?? 0) + (overflowTotal ?? 0);

	const shedRate = familySumRate(history, PD_ADMISSION_SHED, maxGapMs);
	const overflowRate = familySumRate(history, PD_ADMISSION_OVERFLOW_SHED, maxGapMs);
	const queuedRate = familySumRate(history, PD_ADMISSION_QUEUED, maxGapMs);

	// Only the exported valves are summed: an absent family contributes no
	// derivable term, and including it would turn the whole answer into
	// "insufficient samples" on a build that simply predates it.
	const dropTerms: RateResult[] = [];
	if (shedExported) dropTerms.push(shedRate);
	if (overflowExported) dropTerms.push(overflowRate);

	return {
		kind: 'ok',
		mode,
		verdict: admissionVerdict(dropTotal, queuedTotal),
		dropRate: sumRates(dropTerms),
		queuedRate,
		shedRate,
		overflowRate,
		shedTotal,
		overflowTotal,
		queuedTotal,
		dropTotal,
		// ⚠️ Queueing PROVEN armed while the only reachable valve is absent
		// from the scrape. Not inferred from `indeterminate`: a gateway that
		// has simply never filled its pool is not blind, it is idle.
		blindSpot: mode === 'queueing' && !overflowExported,
	};
}
