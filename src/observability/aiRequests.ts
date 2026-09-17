//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {computeCounterRate, RateResult} from './rates';
import {aggregateSum, selectSamples} from './selectors';
import {familySumRate, groupRates, IGroupRate, LabelMatch, LabelPredicate, matchesLabels} from './snapshotRates';

//---------------------------------------------------------
// loxilb_ai_requests_total outcome partition
//---------------------------------------------------------
// The family changed meaning upstream. It used to count only requests a
// backend answered; gateway 27680379 also counts gate denials in it, split by
// an `outcome` label ("completed" | "denied"). Summing the family therefore
// stopped being the completed count on new gateways, while on older ones the
// label does not exist at all and filtering for it would yield nothing.
//
// So the partition is detected from the data rather than assumed either way,
// and every caller that says "completed" selects it explicitly. Upstream sized
// the change to be recoverable exactly like this: outcome="completed"
// reproduces the pre-change series.

export const AI_REQUESTS = 'loxilb_ai_requests_total';
const OUTCOME = 'outcome';
export const OUTCOME_COMPLETED = 'completed';

/**
 * Whether this instance's exposition partitions AI requests by outcome. Read
 * off the live snapshot, not the vendored manifest: the manifest describes the
 * gateway the UI was built against, and the instance in front of the user may
 * be older.
 */
export function hasOutcomePartition(snapshot: IMetricsSnapshot | undefined): boolean {
	if (!snapshot) return false;
	return selectSamples(snapshot, AI_REQUESTS).some(s => s.labels[OUTCOME] !== undefined);
}

// Detected off the newest snapshot — the same one the rate pair ends on, so
// the filter and the arithmetic always describe the same exposition.
function completedFilter(history: readonly IMetricsSnapshot[]): LabelMatch | undefined {
	return hasOutcomePartition(history[history.length - 1]) ? {[OUTCOME]: OUTCOME_COMPLETED} : undefined;
}

/** Rate of requests a backend actually answered, on either gateway shape. */
export function completedRequestRate(history: readonly IMetricsSnapshot[], maxGapMs: number): RateResult {
	return familySumRate(history, AI_REQUESTS, maxGapMs, completedFilter(history));
}

/** The same restriction, grouped (e.g. by HTTP status). */
export function completedRequestRatesBy(
	history: readonly IMetricsSnapshot[],
	groupBy: readonly string[],
	maxGapMs: number,
): IGroupRate[] {
	return groupRates(history, AI_REQUESTS, groupBy, maxGapMs, completedFilter(history));
}

//---------------------------------------------------------
// Offered load, denials and the error ratio (UI-MON-008)
//---------------------------------------------------------
// What the outcome partition unlocked. Upstream states the three readings at
// the source (api/prometheus/ai_metrics.go):
//
//	sum(rate(loxilb_ai_requests_total[5m]))    offered load
//	...{outcome="completed"}                   served traffic
//	...{outcome="denied"}                      gate refusals
//
// The two outcome values are mutually exclusive per request, so they sum back
// to the unfiltered family — which is what makes the unfiltered sum a real
// denominator and a ratio over it meaningful.
//
// ⚠️ Only on a PARTITIONED exposition. On a gateway that predates the label the
// same unfiltered sum is the completed count and nothing else, because denials
// were never in the family. Rendering it as "total" there would restate exactly
// the falsehood the page's notice was written to prevent, so every quantity
// below is gated on the partition rather than computed and captioned.

export const OUTCOME_DENIED = 'denied';

/**
 * Whether a `status` label value denotes a failed response.
 *
 * A missing or unparseable status is deliberately NOT an error: it still
 * counts in the denominator (it was a real request) but never in the
 * numerator, so a malformed label understates the ratio rather than inventing
 * failures. Upstream always writes a numeric code, so this is defensive.
 */
export function isErrorStatus(status: string | undefined): boolean {
	if (status === undefined) return false;
	// Reject anything that is not purely digits — Number('') is 0, and
	// Number.parseInt('4xx') is 4, either of which would silently misclassify.
	if (!/^\d+$/.test(status)) return false;
	return Number(status) >= 400;
}

// A request that did not get a successful answer: refused at the gate, or
// answered with a failing status. The two are disjoint (outcome values are
// mutually exclusive, and a denial's status is its refusal code), so this
// counts each request once. Expressed as ONE predicate rather than two summed
// rates on purpose — see LabelPredicate: summing per-group rates would report
// insufficient-samples for the whole ratio the first time any new status code
// appeared.
const errorFilter: LabelPredicate = labels => labels[OUTCOME] === OUTCOME_DENIED || isErrorStatus(labels['status']);

/**
 * Sum rate over a partition that may legitimately match no sample.
 *
 * `familySumRate` answers insufficient-samples when a filter matches nothing,
 * which is right where absence means "unknown". It is WRONG for a partition of
 * a family that is present: a counter child is only created on its first
 * increment, so a gateway that has never denied a request exports no
 * `outcome="denied"` series at all, and its denial rate is genuinely 0/s. Read
 * as "warming up", a healthy gateway would show no error ratio forever — the
 * absent-series-is-not-zero rule inverted by the fact that the family itself
 * is right there.
 *
 * The family must be present in BOTH observations for that reasoning to hold.
 * If it is absent, nothing is known and the answer stays insufficient-samples.
 */
function partitionRate(history: readonly IMetricsSnapshot[], maxGapMs: number, where: LabelMatch): RateResult {
	const current = history[history.length - 1];
	const previous = history.length >= 2 ? history[history.length - 2] : undefined;
	if (!current || !previous) return {kind: 'insufficient-samples'};
	if (!current.families.get(AI_REQUESTS) || !previous.families.get(AI_REQUESTS)) return {kind: 'insufficient-samples'};

	const sumOf = (s: IMetricsSnapshot) => {
		const matched = selectSamples(s, AI_REQUESTS).filter(x => matchesLabels(x.labels, where));
		// No match at all is a true zero here; a match whose samples are all
		// non-finite is not, and aggregateSum already distinguishes them.
		return matched.length === 0 ? 0 : aggregateSum(matched).value;
	};

	const before = sumOf(previous);
	const now = sumOf(current);
	return computeCounterRate(
		before === undefined ? undefined : {value: before, receivedAtMs: previous.receivedAtMs},
		now === undefined ? undefined : {value: now, receivedAtMs: current.receivedAtMs},
		maxGapMs,
	);
}

/**
 * A ratio of two rates over the same snapshot pair.
 *
 * `no-traffic` is its own answer and not zero: with no offered load the ratio
 * is 0/0, and printing "0% errors" over an idle gateway asserts health that
 * was never measured.
 */
export type RatioResult =
	| {kind: 'ok'; ratio: number}
	| {kind: 'no-traffic'}
	| {kind: 'not-derivable'; reason: Exclude<RateResult['kind'], 'ok'>};

function ratioOf(numerator: RateResult, denominator: RateResult): RatioResult {
	if (numerator.kind !== 'ok') return {kind: 'not-derivable', reason: numerator.kind};
	if (denominator.kind !== 'ok') return {kind: 'not-derivable', reason: denominator.kind};
	if (denominator.perSecond <= 0) return {kind: 'no-traffic'};
	// Deliberately unclamped. The numerator selects a subset of the
	// denominator's samples, so > 1 is arithmetically impossible; if it ever
	// shows, the partition assumption has broken and an operator needs to see
	// that rather than a tidy 100%.
	return {kind: 'ok', ratio: numerator.perSecond / denominator.perSecond};
}

/**
 * Every outcome-derived quantity for the AI traffic page, from ONE partition
 * detection over ONE snapshot pair — so the caption and the arithmetic can
 * never describe different expositions.
 */
export type RequestOutcomes =
	| {kind: 'unpartitioned'}
	| {
			kind: 'partitioned';
			/** Offered load: everything the gateway was asked to do. */
			offered: RateResult;
			/** Answered by a backend. */
			completed: RateResult;
			/** Refused by the policy gate; no backend was asked. */
			denied: RateResult;
			/** Answered, but with a 4xx/5xx status. */
			failed: RateResult;
			/** (denied + failed) / offered. */
			errorRatio: RatioResult;
		};

export function requestOutcomes(history: readonly IMetricsSnapshot[], maxGapMs: number): RequestOutcomes {
	if (!hasOutcomePartition(history[history.length - 1])) return {kind: 'unpartitioned'};

	const offered = partitionRate(history, maxGapMs, () => true);
	const completed = partitionRate(history, maxGapMs, {[OUTCOME]: OUTCOME_COMPLETED});
	const denied = partitionRate(history, maxGapMs, {[OUTCOME]: OUTCOME_DENIED});
	const failed = partitionRate(history, maxGapMs, l => l[OUTCOME] === OUTCOME_COMPLETED && isErrorStatus(l['status']));
	const errors = partitionRate(history, maxGapMs, errorFilter);

	return {kind: 'partitioned', offered, completed, denied, failed, errorRatio: ratioOf(errors, offered)};
}
