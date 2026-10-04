//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {RateResult} from './rates';
import {selectSamples} from './selectors';
import {partitionRate} from './snapshotRates';

//---------------------------------------------------------
// Bearer (JWT) auth observability — J3
//---------------------------------------------------------
// Five families, split across two surfaces by the question they answer:
// the four keyset families say "is this profile working?" and belong beside
// the profile that defines it; the validation counter is traffic and belongs
// on the AI Traffic page. This module derives both, so the two surfaces can
// never disagree about what a label value means.
//
// ⚠️ Every family here is `conditional-with-proven-writer` in the vendored
// manifest. Absent series are the EXPECTED reading until a profile exists and
// bearer traffic reaches it — a precondition, never an error. The UI is also
// the product's first consumer of this data: no gateway dashboard or alert
// rule reads these families, so nothing upstream has already made these
// judgements.

export const JWKS_KEYS = 'loxilb_ai_jwks_keys';
export const JWKS_LAST_SUCCESS = 'loxilb_ai_jwks_last_success_timestamp_seconds';
export const JWKS_USABLE = 'loxilb_ai_jwks_usable';
export const JWKS_REFRESH = 'loxilb_ai_jwks_refresh_total';
export const JWT_VALIDATION = 'loxilb_ai_jwt_validation_total';

export const JWKS_FAMILIES = [JWKS_KEYS, JWKS_LAST_SUCCESS, JWKS_USABLE, JWKS_REFRESH] as const;

// api/prometheus/jwt_metrics.go: JWKSOutcomeSuccess / JWKSOutcomeFailure.
export const JWKS_OUTCOME_SUCCESS = 'success';
export const JWKS_OUTCOME_FAILURE = 'failure';

//---------------------------------------------------------
// Joining a REST profile name to its metric label
//---------------------------------------------------------
// The collector labels each series with `sanitizeLabel(profileName)`
// (api/prometheus/ai_metrics.go:46), so the label is NOT always the name the
// REST API returns. Comparing them directly would silently report
// "not reported" for every profile whose name contains anything outside
// [A-Za-z0-9._-] — which, because sanitisation is BYTE-wise, includes every
// non-ASCII name this product's Korean and Japanese operators can type.
//
// ⚠️ Byte-wise, not character-wise. Go's regexp replacement runs over UTF-8
// bytes, so "테" (one JS character, three UTF-8 bytes) becomes THREE
// underscores upstream. A JS `String.replace` would produce one and the join
// would miss. This mirrors the gateway byte for byte.

const LABEL_MAX_BYTES = 64;
const UNDERSCORE = 0x5f;

function isSafeLabelByte(b: number): boolean {
	return (
		(b >= 0x30 && b <= 0x39) || // 0-9
		(b >= 0x41 && b <= 0x5a) || // A-Z
		(b >= 0x61 && b <= 0x7a) || // a-z
		b === 0x2e || // .
		b === 0x5f || // _
		b === 0x2d // -
	);
}

/** The metric label value the gateway will emit for a profile of this name. */
export function jwksProfileLabel(name: string): string {
	const bytes = new TextEncoder().encode(name);
	// Replacement is one byte for one byte, so truncating after it matches
	// upstream's order of operations exactly.
	const safe = Uint8Array.from(bytes, b => (isSafeLabelByte(b) ? b : UNDERSCORE)).slice(0, LABEL_MAX_BYTES);
	return new TextDecoder().decode(safe);
}

//---------------------------------------------------------
// Last-success age
//---------------------------------------------------------
// ⚠️ Read as CONTEXT, never as a verdict. The gateway applies its own
// staleness cutoff when it computes `loxilb_ai_jwks_usable`, and the UI does
// not know that cutoff. Deriving health from the age here would let the UI
// call a profile broken while the gateway is admitting traffic on it — the
// exact failure mode this panel exists to prevent.

export type LastSuccessAge =
	| {kind: 'ok'; ageSec: number}
	// The gateway's clock is meaningfully ahead of this browser's. Worth
	// saying out loud on a JWT page specifically: the same skew corrupts
	// `exp`/`nbf` validation, so it is a finding rather than a display glitch.
	| {kind: 'clock-skew'; aheadSec: number}
	// No successful fetch has ever happened. The series is deliberately
	// ABSENT rather than zero upstream — a zero would read as 1970 and make
	// every staleness expression true from the moment a profile is created.
	| {kind: 'never'};

// Slack for ordinary clock jitter and for the time between the gateway
// writing the timestamp and this client finishing the fetch.
export const CLOCK_SKEW_SLACK_SEC = 60;

export function lastSuccessAge(lastSuccessSec: number | undefined, observedAtMs: number): LastSuccessAge {
	if (lastSuccessSec === undefined || !Number.isFinite(lastSuccessSec)) return {kind: 'never'};
	const ageSec = observedAtMs / 1000 - lastSuccessSec;
	if (ageSec < -CLOCK_SKEW_SLACK_SEC) return {kind: 'clock-skew', aheadSec: -ageSec};
	return {kind: 'ok', ageSec: Math.max(0, ageSec)};
}

//---------------------------------------------------------
// Per-profile keyset health
//---------------------------------------------------------
// ⭐ The whole point of this state machine is that a JWKS outage has TWO
// different correct answers, and only one of them is a failure:
//
//   never fetched      ⇒ the gateway refuses bearer traffic with 503
//   fetched then gone  ⇒ the gateway KEEPS ADMITTING on the last-known-good
//                        keyset until its staleness cutoff arbitrates
//
// A badge that painted the second as failure would tell an operator their
// inference plane is down while it is serving every request — and an IdP
// restart is the ordinary way to reach that state. `usable` is the gateway's
// own verdict on whether it admits; `last_success_timestamp_seconds`
// separates "never" from "expired" once it does not.

export type JWKSHealthKind =
	// No series for this profile. Either the gateway exports nothing for it
	// yet or its label collides with another profile's — a precondition or a
	// join problem, never a health verdict.
	| 'not-reported'
	// Two configured profiles sanitize to the same metric label, so the
	// gateway emits one series for the pair and neither can be attributed.
	| 'ambiguous-label'
	// usable=0 with no successful fetch ever: bearer requests get 503.
	| 'never-fetched'
	// usable=0 after at least one success: the keyset aged past the gateway's
	// cutoff. Also 503, but a different story and a different fix.
	| 'stale-cutoff'
	// usable=1 while refreshes are failing: still admitting, on keys that are
	// no longer being renewed. A WARNING, and the window in which an operator
	// can still fix the IdP before it becomes an outage.
	| 'last-known-good'
	// usable=1, nothing failing.
	| 'healthy';

export interface IJWKSHealth {
	/** The profile name as the REST API returns it. */
	profile: string;
	/** The metric label value it maps to. */
	label: string;
	kind: JWKSHealthKind;
	/**
	 * Whether the gateway itself says the bearer arm admits for this profile.
	 * Derived once, here, so no caller re-derives it from `kind` and gets the
	 * last-known-good case backwards.
	 */
	admitting: boolean;
	/** Usable verification keys; undefined when no series was reported. */
	keys: number | undefined;
	lastSuccess: LastSuccessAge;
	refreshSuccess: RateResult;
	refreshFailure: RateResult;
}

export type JWKSHealthReport =
	// No snapshot at all, or the scrape did not confirm. Nothing is known.
	| {kind: 'unavailable'}
	// A snapshot arrived and carries no keyset families. On a gateway with
	// profiles configured this means the build predates them; it is never
	// evidence that a profile is unhealthy.
	| {kind: 'not-exported'}
	| {kind: 'ok'; byProfile: readonly IJWKSHealth[]};

function gaugeByLabel(snapshot: IMetricsSnapshot, family: string): ReadonlyMap<string, number> {
	const out = new Map<string, number>();
	for (const s of selectSamples(snapshot, family)) {
		const profile = s.labels['profile'];
		// A non-finite gauge is not data: leaving it out reads as
		// "not reported", which is true, rather than as a fabricated number.
		if (profile === undefined || !Number.isFinite(s.value)) continue;
		if (!out.has(profile)) out.set(profile, s.value);
	}
	return out;
}

/**
 * Keyset health for a set of configured profiles.
 *
 * `profiles` comes from REST — the configuration is the authority on which
 * profiles exist, and the metric is only the health of the ones the gateway
 * has instantiated. The result is aligned to that input, so a profile the
 * gateway has not reported on still gets a row saying so instead of vanishing.
 */
export function jwksHealthFor(
	profiles: readonly string[],
	snapshot: IMetricsSnapshot | undefined,
	history: readonly IMetricsSnapshot[],
	maxGapMs: number,
): JWKSHealthReport {
	// ⚠️ The CURRENT snapshot is passed separately from the rate history and
	// is not read off its tail. The retention ring is filled in an effect, so
	// on the first observation a caller legitimately holds a snapshot while
	// `history` is still empty — reading the tail there answers "unavailable",
	// which means "the scrape did not answer" and is a different, alarming
	// claim. The gauges come from the snapshot; only the rates need the pair,
	// and with one observation they correctly say "warming up".
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	// `usable` is emitted for every profile the manager knows, unconditionally
	// — so its absence, not the absence of the optional timestamp family, is
	// what says the gateway reports no keyset health at all.
	if (!snapshot.families.get(JWKS_USABLE)) return {kind: 'not-exported'};

	const usable = gaugeByLabel(snapshot, JWKS_USABLE);
	const keys = gaugeByLabel(snapshot, JWKS_KEYS);
	const lastSuccess = gaugeByLabel(snapshot, JWKS_LAST_SUCCESS);

	// ⚠️ `partitionRate`, not a per-group lookup. A counter child exists only
	// once incremented, so a profile whose JWKS fetch has NEVER succeeded
	// exports no `outcome="success"` series at all — confirmed on the live
	// gateway, which carried `outcome="failure"` for a probe profile with no
	// success child beside it. A missing group read as insufficient-samples
	// would print "Warming up…" in the Refresh-ok column forever, on exactly
	// the profile that is failing. The family being present is what makes the
	// absent child a genuine 0/s.
	const refreshRate = (label: string, outcome: string): RateResult =>
		partitionRate(history, JWKS_REFRESH, maxGapMs, {profile: label, outcome});

	// ⚠️ Distinct profile names can sanitize to the same label, and the
	// collector then drops all but the first. Attributing that one series to
	// both profiles would show one profile's health under the other's name on
	// a security page. Neither gets a verdict.
	const labelCounts = new Map<string, number>();
	for (const name of profiles) {
		const l = jwksProfileLabel(name);
		labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
	}

	const byProfile = profiles.map<IJWKSHealth>(profile => {
		const label = jwksProfileLabel(profile);
		const base = {
			profile,
			label,
			keys: keys.get(label),
			lastSuccess: lastSuccessAge(lastSuccess.get(label), snapshot.receivedAtMs),
			refreshSuccess: refreshRate(label, JWKS_OUTCOME_SUCCESS),
			refreshFailure: refreshRate(label, JWKS_OUTCOME_FAILURE),
		};

		if ((labelCounts.get(label) ?? 0) > 1) return {...base, kind: 'ambiguous-label', admitting: false};

		const u = usable.get(label);
		if (u === undefined) return {...base, kind: 'not-reported', admitting: false};

		if (u === 0) {
			return base.lastSuccess.kind === 'never'
				? {...base, kind: 'never-fetched', admitting: false}
				: {...base, kind: 'stale-cutoff', admitting: false};
		}

		// Admitting. The only question left is whether the keys behind that
		// are still being renewed. A failure RATE is the right instrument: a
		// failure count would paint the badge forever over an outage that has
		// since recovered. An absent failure child is genuinely no failures,
		// and an underivable rate simply does not raise the warning — this
		// qualifies a healthy verdict, it never manufactures a bad one.
		const failing = base.refreshFailure.kind === 'ok' && base.refreshFailure.perSecond > 0;
		return {...base, kind: failing ? 'last-known-good' : 'healthy', admitting: true};
	});

	return {kind: 'ok', byProfile};
}

//---------------------------------------------------------
// Bearer admission verdicts
//---------------------------------------------------------
// `loxilb_ai_jwt_validation_total{tenant,reason}` counts one verdict per call
// into the bearer gate. reason="allowed" is an admission; every other value is
// the gate's client-facing error_code (pkg/jwtauth/verdict.go), plus
// "internal_error" from the panic/nil-result arm.

export const JWT_REASON_ALLOWED = 'allowed';
// api/prometheus/jwt_metrics.go JWTLabelAbsent: the verdict was reached
// BEFORE a signature was verified, so no tenant could be attributed to it.
// Attributing those to an unverified claim would let an unauthenticated
// caller choose a label value.
export const JWT_LABEL_ABSENT = '-';

/**
 * What an operator has to do about a reason.
 *
 * ⚠️ `unclassified` is a real member, not a fallback for tidiness. Upstream
 * records promoting the finer reason taxonomy (bad_signature, unknown_kid,
 * oversize) onto this label as an OPEN product decision, so a value this
 * build has never seen is expected eventually. It must surface as itself
 * rather than be forced into a class whose advice would be wrong.
 */
export type BearerReasonClass =
	| 'admitted'
	// The caller's credential: nothing is wrong with the gateway.
	| 'credential'
	// A verified tenant asked for a model it may not have.
	| 'authorization'
	// ⭐ The gateway's OWN fault — it is failing closed and refusing traffic
	// that should have been served. This is the class that needs an operator.
	| 'gateway-fault'
	| 'unclassified';

const REASON_CLASSES: Readonly<Record<string, BearerReasonClass>> = {
	[JWT_REASON_ALLOWED]: 'admitted',
	missing_token: 'credential',
	invalid_token: 'credential',
	token_expired: 'credential',
	model_not_allowed: 'authorization',
	policy_store_unavailable: 'gateway-fault',
	internal_error: 'gateway-fault',
};

export function classifyBearerReason(reason: string): BearerReasonClass {
	return REASON_CLASSES[reason] ?? 'unclassified';
}

export interface IBearerReasonRate {
	reason: string;
	reasonClass: BearerReasonClass;
	rate: RateResult;
	/**
	 * Tenants that contributed to this reason. `-` means the verdict was
	 * reached before verification, so it is the expected value on nearly every
	 * refusal — it is not a missing label.
	 */
	tenants: readonly string[];
}

export type BearerAdmission =
	| {kind: 'unavailable'}
	// The family is absent. Expected until a rule selects the bearer arm and
	// a request carrying an Authorization header reaches it.
	| {kind: 'not-exported'}
	| {
			kind: 'ok';
			/** reason="allowed". */
			admitted: RateResult;
			/** Everything else — so a reason this build does not know still counts. */
			denied: RateResult;
			/** The subset the gateway caused. */
			gatewayFault: RateResult;
			/** Every reason present, highest rate first. */
			byReason: readonly IBearerReasonRate[];
		};

export function bearerAdmission(
	snapshot: IMetricsSnapshot | undefined,
	history: readonly IMetricsSnapshot[],
	maxGapMs: number,
): BearerAdmission {
	// Same split as jwksHealthFor: the presence of the family is read off the
	// current snapshot, the rates off the pair. A first observation therefore
	// reads as "warming up", never as a failed scrape.
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	if (!snapshot.families.get(JWT_VALIDATION)) return {kind: 'not-exported'};

	// Denied is "not allowed" rather than a list of known refusal codes: the
	// gate increments exactly once per call, so the complement is exact and
	// stays correct when upstream adds a reason value.
	const admitted = partitionRate(history, JWT_VALIDATION, maxGapMs, {reason: JWT_REASON_ALLOWED});
	const denied = partitionRate(history, JWT_VALIDATION, maxGapMs, l => l['reason'] !== JWT_REASON_ALLOWED);
	const gatewayFault = partitionRate(history, JWT_VALIDATION, maxGapMs, l => classifyBearerReason(l['reason'] ?? '') === 'gateway-fault');

	// Rows come from the CURRENT snapshot, not from groupRates over the pair:
	// with a single observation groupRates yields nothing, and an empty reason
	// table under a present family would read as "no verdicts", contradicting
	// the family's own existence. Each row's RATE still needs the pair, and
	// `partitionRate` answers insufficient-samples there — so the table lists
	// what exists and says honestly that it cannot rate it yet.
	const tenantsByReason = new Map<string, Set<string>>();
	for (const sample of selectSamples(snapshot, JWT_VALIDATION)) {
		const reason = sample.labels['reason'] ?? '';
		const set = tenantsByReason.get(reason) ?? new Set<string>();
		set.add(sample.labels['tenant'] ?? JWT_LABEL_ABSENT);
		tenantsByReason.set(reason, set);
	}

	const byReason = [...tenantsByReason.entries()]
		.map<IBearerReasonRate>(([reason, tenants]) => ({
			reason,
			reasonClass: classifyBearerReason(reason),
			rate: partitionRate(history, JWT_VALIDATION, maxGapMs, {reason}),
			tenants: [...tenants].sort(),
		}))
		// Sort by rate so what is happening now leads, with underivable rows
		// last rather than interleaved. Ties keep a stable reason order so the
		// table does not reshuffle between polls.
		.sort((a, b) => {
			const av = a.rate.kind === 'ok' ? a.rate.perSecond : -1;
			const bv = b.rate.kind === 'ok' ? b.rate.perSecond : -1;
			return bv - av || a.reason.localeCompare(b.reason);
		});

	return {kind: 'ok', admitted, denied, gatewayFault, byReason};
}
