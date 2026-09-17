//---------------------------------------------------------
// Counter-rate derivation (UI-MON-003)
//---------------------------------------------------------
// Rates are computed from consecutive snapshot observations of a cumulative
// counter — at least two valid points and real elapsed time, per the request
// contract. Every degenerate condition is a TYPED result, never a zero:
// a reset (gateway restart), reversed/zero elapsed time, a hidden-tab gap
// larger than the tolerance, or a non-finite sample each say what they are
// so the widget renders the right state instead of a fabricated 0/s.
//
// With the recorded shared-cadence decision points arrive every 10 s: rates update
// on 10-second boundaries, and display ticks in between must not synthesize
// intermediate values.

export interface ICounterPoint {
	value: number;
	receivedAtMs: number;
}

export type RateResult =
	| {kind: 'ok'; perSecond: number; intervalMs: number}
	| {kind: 'insufficient-samples'}
	| {kind: 'invalid-sample'}   // non-finite counter value
	| {kind: 'invalid-interval'} // reversed or zero elapsed time
	| {kind: 'reset'}            // counter decreased — restart, not negative traffic
	| {kind: 'gap'};             // elapsed time beyond tolerance (hidden tab, missed polls)

export function computeCounterRate(
	previous: ICounterPoint | undefined,
	current: ICounterPoint | undefined,
	maxGapMs: number,
): RateResult {
	if (!previous || !current) return {kind: 'insufficient-samples'};
	if (!Number.isFinite(previous.value) || !Number.isFinite(current.value)) return {kind: 'invalid-sample'};
	const intervalMs = current.receivedAtMs - previous.receivedAtMs;
	if (intervalMs <= 0) return {kind: 'invalid-interval'};
	if (intervalMs > maxGapMs) return {kind: 'gap'};
	if (current.value < previous.value) return {kind: 'reset'};
	return {kind: 'ok', perSecond: (current.value - previous.value) / (intervalMs / 1000), intervalMs};
}

//---------------------------------------------------------
// Retention ring
//---------------------------------------------------------
// Bounded history of observations for rate/spark derivation. Deliberately a
// plain value-object API (push returns a new array) so it can live in React
// state/refs and be purged by unmount — component-local retention is what
// keeps the logout purge story simple: no module-level series survives the
// session (the RQ cache purge does not know about derived accumulators).

export function pushRetained<T extends {receivedAtMs: number}>(ring: readonly T[], point: T, capacity: number): T[] {
	// Ignore a duplicate delivery of the same observation (React effects can
	// fire more than once per snapshot without this being a new data point).
	if (ring.length > 0 && ring[ring.length - 1].receivedAtMs === point.receivedAtMs) return [...ring];
	return [...ring, point].slice(-capacity);
}

/**
 * A ratio of two rates over the same snapshot pair.
 *
 * `no-traffic` is its own answer and not zero: with no offered load the ratio
 * is 0/0, and printing "0% errors" over an idle gateway asserts health that
 * was never measured.
 *
 * Lives here rather than beside its first caller because a second one
 * arrived: the P/D tier mix expresses every tier as a share of all
 * selections. The same move `partitionRate` made into `snapshotRates.ts` —
 * a shared primitive, not an AI-request detail.
 */
export type RatioResult =
	| {kind: 'ok'; ratio: number}
	| {kind: 'no-traffic'}
	| {kind: 'not-derivable'; reason: Exclude<RateResult['kind'], 'ok'>};

export function ratioOf(numerator: RateResult, denominator: RateResult): RatioResult {
	if (numerator.kind !== 'ok') return {kind: 'not-derivable', reason: numerator.kind};
	if (denominator.kind !== 'ok') return {kind: 'not-derivable', reason: denominator.kind};
	if (denominator.perSecond <= 0) return {kind: 'no-traffic'};
	// Deliberately unclamped. The numerator selects a subset of the
	// denominator's samples, so > 1 is arithmetically impossible; if it ever
	// shows, the partition assumption has broken and an operator needs to see
	// that rather than a tidy 100%.
	return {kind: 'ok', ratio: numerator.perSecond / denominator.perSecond};
}
