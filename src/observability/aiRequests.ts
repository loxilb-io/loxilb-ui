//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {RateResult} from './rates';
import {selectSamples} from './selectors';
import {familySumRate, groupRates, IGroupRate, LabelMatch} from './snapshotRates';

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
