//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {familyAbsence} from './familyActivation';
import {RateResult, RatioResult, ratioOf} from './rates';
import {selectSamples} from './selectors';
import {familySumRate, groupRates, IGroupRate, LabelMatch, LabelPredicate, partitionRate} from './snapshotRates';

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

// Every quantity below is a partition of `loxilb_ai_requests_total`, so they
// all go through `partitionRate`: the family is present, and a child that has
// never been incremented is a genuine 0/s rather than an unknown. See its doc
// comment for why that inverts the usual absent-series rule.
const rateOf = (history: readonly IMetricsSnapshot[], maxGapMs: number, where: LabelMatch) =>
	partitionRate(history, AI_REQUESTS, maxGapMs, where);

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

	const offered = rateOf(history, maxGapMs, () => true);
	const completed = rateOf(history, maxGapMs, {[OUTCOME]: OUTCOME_COMPLETED});
	const denied = rateOf(history, maxGapMs, {[OUTCOME]: OUTCOME_DENIED});
	const failed = rateOf(history, maxGapMs, l => l[OUTCOME] === OUTCOME_COMPLETED && isErrorStatus(l['status']));
	const errors = rateOf(history, maxGapMs, errorFilter);

	return {kind: 'partitioned', offered, completed, denied, failed, errorRatio: ratioOf(errors, offered)};
}

//---------------------------------------------------------
// Denials: one total, and reasons that do not overlap
//---------------------------------------------------------
// The gateway records a refusal's REASON in two families whose sets overlap:
// every token-quota refusal increments `rate_limit_hits_total` (reason
// token_quota_exceeded / token_quota_would_exceed) AND
// `token_quota_denied_total`, at both of its call sites, and has since the
// quota family was introduced. Upstream documents this as a hierarchy, not a
// defect (api/prometheus/ai_metrics.go). Summing the families therefore
// counted every quota refusal twice, and listing them side by side as
// sibling reasons implied two disjoint causes.
//
// So the total never sums reasons where the gateway states it directly, and
// the reason rows below are disjoint by construction:
//
//   rate limited        rate_limit_hits{reason !~ token_quota_*}
//   token quota denied  token_quota_denied   (= the two quota reasons above)
//   quota warming       rate_limit_hits{reason="token_quota_warming"}
//   model not allowed   model_not_allowed    (a different gate; never in hits)
//
// `token_quota_warming` is the one quota-state reason NOT in
// token_quota_denied: excluding every token_quota_* reason from "rate
// limited" without giving it its own row would make it vanish from the page.

export const RATE_LIMIT_HITS = 'loxilb_ai_rate_limit_hits_total';
export const MODEL_NOT_ALLOWED = 'loxilb_ai_model_not_allowed_total';
export const TOKEN_QUOTA_DENIED = 'loxilb_ai_token_quota_denied_total';

const REASON = 'reason';
const TOKEN_QUOTA_REASON_PREFIX = 'token_quota_';
export const TOKEN_QUOTA_WARMING = 'token_quota_warming';

const isTokenQuotaReason: LabelPredicate = labels => (labels[REASON] ?? '').startsWith(TOKEN_QUOTA_REASON_PREFIX);

/**
 * Which gate a `rate_limit_hits_total` reason belongs to. The family carries
 * token-quota refusals beside the request-rate buckets, so a page listing it
 * by reason must not put "Rate limited" in front of a quota refusal.
 */
export type RateLimitHitKind = 'rate-limit' | 'token-quota' | 'token-quota-warming';

export function rateLimitHitKind(reason: string | undefined): RateLimitHitKind {
	if (reason === TOKEN_QUOTA_WARMING) return 'token-quota-warming';
	return isTokenQuotaReason({[REASON]: reason ?? ''}) ? 'token-quota' : 'rate-limit';
}

/**
 * Rate over a partition of a family that may be absent altogether.
 *
 * An absent family answers with the manifest's reading, like `familySumRate`.
 * A present one is read as a partition (`partitionRate`): a reason the gateway
 * has never recorded has no child series, and that is a true 0/s, not a
 * warm-up that never ends.
 */
function reasonRate(history: readonly IMetricsSnapshot[], family: string, maxGapMs: number, where: LabelMatch): RateResult {
	const reading = familyAbsence(history[history.length - 1], family);
	if (reading) return {kind: 'absent', reading};
	return partitionRate(history, family, maxGapMs, where);
}

export interface DenialReasons {
	/** Request-rate buckets: key, user and tenant rps/burst. */
	rateLimited: RateResult;
	/** Either token-quota refusal mode (latched, or would not fit). */
	tokenQuotaDenied: RateResult;
	/** Quota state still cold after a restart; refused until it is known. */
	tokenQuotaWarming: RateResult;
	/** The key does not allow the requested model. */
	modelNotAllowed: RateResult;
}

export function denialReasons(history: readonly IMetricsSnapshot[], maxGapMs: number): DenialReasons {
	return {
		rateLimited: reasonRate(history, RATE_LIMIT_HITS, maxGapMs, labels => !isTokenQuotaReason(labels)),
		tokenQuotaDenied: familySumRate(history, TOKEN_QUOTA_DENIED, maxGapMs),
		tokenQuotaWarming: reasonRate(history, RATE_LIMIT_HITS, maxGapMs, {[REASON]: TOKEN_QUOTA_WARMING}),
		modelNotAllowed: familySumRate(history, MODEL_NOT_ALLOWED, maxGapMs),
	};
}

/**
 * Sum of disjoint denial terms, where an ABSENT term contributes nothing.
 *
 * Every term is a lazy counter vec: absent from a healthy scrape means no
 * child was ever incremented, so its share of this interval's rate is exactly
 * zero. That only holds while some other term is present to prove the scrape
 * is measuring at all — every term absent stays absent (the first reading),
 * never a manufactured 0/s. Any other degenerate result (a reset, a gap, one
 * observation) propagates: summing around it would understate silently.
 */
function sumDenialTerms(terms: readonly RateResult[]): RateResult {
	const present = terms.filter(r => r.kind !== 'absent');
	if (present.length === 0) return terms[0] ?? {kind: 'insufficient-samples'};
	const notOk = present.find(r => r.kind !== 'ok');
	if (notOk) return notOk;
	let perSecond = 0;
	let intervalMs = 0;
	for (const r of present) {
		if (r.kind !== 'ok') continue;
		perSecond += r.perSecond;
		intervalMs = Math.max(intervalMs, r.intervalMs);
	}
	return {kind: 'ok', perSecond, intervalMs};
}

/**
 * Rate of requests the gateway refused, counted once each.
 *
 * Where the exposition partitions requests by outcome, this IS
 * `requests_total{outcome="denied"}` — the gateway's own count, which also
 * covers refusals no reason family records (an invalid key, an unavailable
 * policy store). On an older gateway without that label it falls back to the
 * disjoint reason families: every rate_limit_hits reason, plus
 * model_not_allowed. token_quota_denied is never added: it is already inside
 * rate_limit_hits on every gateway that exports it.
 */
export function denialTotalRate(history: readonly IMetricsSnapshot[], maxGapMs: number): RateResult {
	if (hasOutcomePartition(history[history.length - 1])) {
		return rateOf(history, maxGapMs, {[OUTCOME]: OUTCOME_DENIED});
	}
	return sumDenialTerms([familySumRate(history, RATE_LIMIT_HITS, maxGapMs), familySumRate(history, MODEL_NOT_ALLOWED, maxGapMs)]);
}

//---------------------------------------------------------
// Responses with no usage object
//---------------------------------------------------------
// `loxilb_ai_tokens_missing_total` counts RESPONSES, not tokens: one per 2xx
// response that carried no readable usage object. Its `reason` names where
// the report fired, and exactly one of them was charged anyway —
// `stream_estimated`, a stream billed from the estimate net. The rest went
// uncharged. Summed whole, the family put charged and uncharged responses
// under one "unaccountable" heading.

export const TOKENS_MISSING = 'loxilb_ai_tokens_missing_total';
export const TOKENS_MISSING_STREAM_ESTIMATED = 'stream_estimated';

export interface UsageMissingRates {
	/** Responses with no usage that were never charged. */
	uncharged: RateResult;
	/** Streams charged from the estimate net instead. */
	chargedFromEstimate: RateResult;
}

export function usageMissingRates(history: readonly IMetricsSnapshot[], maxGapMs: number): UsageMissingRates {
	return {
		uncharged: reasonRate(history, TOKENS_MISSING, maxGapMs, l => l[REASON] !== TOKENS_MISSING_STREAM_ESTIMATED),
		chargedFromEstimate: reasonRate(history, TOKENS_MISSING, maxGapMs, {[REASON]: TOKENS_MISSING_STREAM_ESTIMATED}),
	};
}
