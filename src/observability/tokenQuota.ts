//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot, IMetricSample} from 'types/observability';
import {selectSamples} from './selectors';

//---------------------------------------------------------
// Token-quota utilization across six identity scopes (Stage 3.6)
//---------------------------------------------------------
// The gateway meters LLM tokens per minute against a ladder of buckets. A
// request's spend lands on EVERY bucket whose limit resolves, and
// `quotaBucketsFor` (`pkg/loxinet/ai_gateway_dp.go:1107`) builds that list in
// a fixed order: tenant aggregate, tenant|model, user aggregate, user|model,
// key, VIP-shared. Each scope is exported on its OWN family pair — a
// utilization gauge and a limit gauge — because, as the collector's own
// comment puts it, "user is not a spelling of tenant": a per-key bucket
// published as {tenant="kq:<id>"} would move a saturation alert by exactly as
// much as a real tenant would.
//
// ⭐ TWELVE gauges over SIX scopes, not the eight over five the stage brief
// carried. The tenant ladder is two scopes (aggregate and tenant|model), and
// the brief folded them into one. Re-derived from the vendored manifest and
// confirmed against `tokenQuotaCollector.Collect`.
//
// ⭐⭐ THE READING THIS PANEL EXISTS TO DISAMBIGUATE, and it is the sharpest
// case of the campaign's governing rule so far. All twelve families are
// absent in BOTH of these situations, and the exposition cannot tell them
// apart:
//
//   (a) no quota is configured        — benign, the common case
//   (b) the quota store is UNREACHABLE — quotas are NOT BEING ENFORCED
//
// (b) is not a hypothetical. `quotaBucketsFor` tolerates a store read error
// on purpose — settlement runs mid-request, and an unreleased reservation
// would deny a tenant's admissions until the epoch expired it — so on a store
// outage every bucket "drops out exactly as an unlimited one would". The
// gateway fails OPEN: traffic that should be throttled is admitted, and the
// metric looks precisely like a gateway with nothing configured. Only the
// configuration read distinguishes them, and it does so by an error CODE:
// `ai_key_store_unconfigured` is (a), `ai_key_store_unavailable` is (b).
// Rendering both as "no quotas configured" would hide an active fail-open.
//
// ⚠️⚠️ UTILIZATION MAY LEGITIMATELY EXCEED 1.0. The value is computed at
// scrape time as consumed/limit over live rate-limiter state, and a response's
// exact token usage is only known at settle — so a bucket goes into post-hoc
// debt and reads above 1.0 until it refills. That is the limiter working as
// designed. Do NOT clamp it to 100% and do NOT paint it as an error; the
// operator-meaningful distinction is `saturated` (at the bound) versus
// `in-debt` (over it, and denying the next request).
//
// ⚠️ `key_id` is the store's opaque identifier, never key material. It is not
// resolvable to a key and must not be prettified.
//
// ⚠️ A SCOPE'S ABSENCE IS NOT ONE FACT ACROSS THE SIX. The preconditions
// differ in kind, which is why `scopeAbsence` exists rather than one shared
// sentence:
//   - tenant / tenant|model / user / user|model  need a resolved limit;
//   - key / VIP                                  need a resolved limit AND a
//     charge (the bucket is created BY a charge and reaped after inactivity);
//   - user / user|model additionally need a RESOLVED USER IDENTITY, which
//     comes from bearer/JWT validation only — the API-key table carries no
//     user binding, so on a gateway authenticating with X-Api-Key alone these
//     two are correctly absent forever and nothing an operator does to the
//     quota configuration will make them appear.
//
// ⭐ Pattern 4 ("build the row set from REST configuration, not from
// accumulated labels") does NOT apply here, and the reason is structural. It
// existed because a `promauto` counter's children live for the process
// lifetime, so a deleted profile keeps exporting. These twelve are `desc`
// gauges computed at scrape time from live state: their cardinality is bounded
// by ACTIVE buckets, and the store's Cleanup reaps an idle one. A scrape-time
// collector carries no dead children by construction, so the rows ARE the
// current truth and reading them off the exposition is correct.
//
// ⚠️ Pattern 5 ("ask REST what a zero is supposed to look like") applies only
// HALFWAY, in a shape neither 3.2 nor 3.4 met. The gate values are reachable —
// unlike 3.4's `getenv`-only depth — but the collection endpoints are
// POST-only (`GET /config/ai/tenant/ratelimit` answers 405), so there is no
// way to ENUMERATE the identities that should have series. The UI can answer
// "should THIS tenant have a bucket?" and cannot answer "which tenants
// should?". That is why `quotaVerdict` takes the limits the caller could
// actually resolve and never infers from their absence alone.

//---------------------------------------------------------
// Family names
//---------------------------------------------------------

export const TOKEN_QUOTA_DENIED = 'loxilb_ai_token_quota_denied_total';
export const TOKEN_QUOTA_COLD_OPEN = 'loxilb_ai_token_quota_cold_open_total';

export type QuotaScope = 'tenant' | 'tenant-model' | 'user' | 'user-model' | 'key' | 'vip';

export interface IQuotaScopeFamilies {
	scope: QuotaScope;
	utilization: string;
	limit: string;
	/** Label names, in the collector's own order. */
	labels: readonly string[];
	/**
	 * Whether a bucket needs a CHARGE before it exists, on top of a resolved
	 * limit. The tenant and user ladders are published from the resolved
	 * store state; key and VIP buckets are created by the charge itself.
	 */
	needsCharge: boolean;
	/**
	 * Whether the scope needs a user identity resolved by bearer/JWT. Never
	 * satisfiable on a gateway authenticating with X-Api-Key alone.
	 */
	needsUserIdentity: boolean;
	/**
	 * Whether an unset explicit limit falls through to the QoS defaults
	 * ladder. Only the two AGGREGATE scopes do: `quotaBucketsFor` substitutes
	 * `defaults.tenantTPM` / `defaults.userTPM` for a non-positive explicit
	 * value, while the per-model and per-key scopes have no default at all.
	 * VIP is the inverse — it exists ONLY as a default.
	 */
	fallsThroughToDefaults: boolean;
}

// ⚠️ Order is the ladder order from `quotaBucketsFor`, which is also the
// order an operator reasons in: broadest bucket first.
export const QUOTA_SCOPES: readonly IQuotaScopeFamilies[] = [
	{
		scope: 'tenant',
		utilization: 'loxilb_ai_token_quota_utilization',
		limit: 'loxilb_ai_token_quota_limit_tokens',
		labels: ['tenant'],
		needsCharge: false,
		needsUserIdentity: false,
		fallsThroughToDefaults: true,
	},
	{
		scope: 'tenant-model',
		utilization: 'loxilb_ai_token_quota_model_utilization',
		limit: 'loxilb_ai_token_quota_model_limit_tokens',
		labels: ['tenant', 'model'],
		needsCharge: false,
		needsUserIdentity: false,
		fallsThroughToDefaults: false,
	},
	{
		scope: 'user',
		utilization: 'loxilb_ai_user_token_quota_utilization',
		limit: 'loxilb_ai_user_token_quota_limit_tokens',
		labels: ['tenant', 'user'],
		needsCharge: false,
		needsUserIdentity: true,
		fallsThroughToDefaults: true,
	},
	{
		scope: 'user-model',
		utilization: 'loxilb_ai_user_model_token_quota_utilization',
		limit: 'loxilb_ai_user_model_token_quota_limit_tokens',
		labels: ['tenant', 'user', 'model'],
		needsCharge: false,
		needsUserIdentity: true,
		fallsThroughToDefaults: false,
	},
	{
		scope: 'key',
		utilization: 'loxilb_ai_key_token_quota_utilization',
		limit: 'loxilb_ai_key_token_quota_limit_tokens',
		labels: ['key_id'],
		needsCharge: true,
		needsUserIdentity: false,
		fallsThroughToDefaults: false,
	},
	{
		scope: 'vip',
		utilization: 'loxilb_ai_vip_token_quota_utilization',
		limit: 'loxilb_ai_vip_token_quota_limit_tokens',
		labels: ['service'],
		needsCharge: true,
		needsUserIdentity: false,
		fallsThroughToDefaults: false,
	},
];

/** Every quota family this module reads, for the capability registry. */
export const TOKEN_QUOTA_FAMILIES: readonly string[] = [
	...QUOTA_SCOPES.flatMap(s => [s.utilization, s.limit]),
	TOKEN_QUOTA_DENIED,
	TOKEN_QUOTA_COLD_OPEN,
];

export function quotaScope(scope: QuotaScope): IQuotaScopeFamilies {
	// Non-null: QUOTA_SCOPES covers the union exhaustively and
	// `every scope is covered` in the test file fails the build otherwise.
	return QUOTA_SCOPES.find(s => s.scope === scope) as IQuotaScopeFamilies;
}

//---------------------------------------------------------
// The quota store's reachability
//---------------------------------------------------------

/**
 * What the quota CONFIGURATION read said about the store behind it.
 *
 * ⭐⭐ This is the only thing that separates a benign empty exposition from an
 * active fail-open, so it is a first-class input and not an error banner.
 */
export type QuotaStoreState =
	// The configuration answered. Limits it returned are authoritative.
	| 'readable'
	// 503 `ai_key_store_unconfigured`: no store is configured, so no quota can
	// be configured OR enforced. Definite and benign.
	| 'unconfigured'
	// ⚠️ 503 `ai_key_store_unavailable`: a store IS configured and is not
	// answering. Every bucket drops out of `quotaBucketsFor`, so quotas are
	// not being enforced while this lasts.
	| 'unavailable'
	// Anything else, including "not read yet". Never guessed into one of the
	// above — see `quotaVerdict`'s `indeterminate`.
	| 'unknown';

/**
 * Classify a failed quota-configuration read.
 *
 * ⚠️ The two 503 codes arrive in the SAME envelope field and differ only in
 * their value, so this matches the code exactly rather than testing the
 * status: a 503 whose code is neither is `unknown`, not a guessed
 * `unconfigured`. Deny by default, as with the manifest's activation tokens.
 */
export function storeStateFromError(code: number | undefined, resultOrMessage: string | undefined): QuotaStoreState {
	if (code !== 503) return 'unknown';
	switch (resultOrMessage) {
		case 'ai_key_store_unconfigured':
			return 'unconfigured';
		case 'ai_key_store_unavailable':
			return 'unavailable';
		default:
			return 'unknown';
	}
}

//---------------------------------------------------------
// The QoS defaults ladder
//---------------------------------------------------------

/** One `/config/ai/ratelimit/defaults/{scope}` row, reduced to token limits. */
export interface IQuotaDefaultsRow {
	defaultTenantTpm?: number;
	defaultUserTpm?: number;
	vipSharedTpm?: number;
}

export interface IQuotaDefaults {
	tenantTpm: number;
	userTpm: number;
	vipTpm: number;
}

export const NO_QUOTA_DEFAULTS: IQuotaDefaults = {tenantTpm: 0, userTpm: 0, vipTpm: 0};

/**
 * Resolve the defaults a request on `rule` would see.
 *
 * ⚠️ FIELD-WISE override, and only by a POSITIVE value — `resolveQoSDefaults`
 * (`ai_gateway_dp.go:107`) applies the rule row over the global row one field
 * at a time through an `if v > 0` guard. So a rule row is not a replacement:
 * a rule that sets only `vip_shared_tpm` still inherits the global tenant and
 * user defaults, and a rule row of zeros changes nothing. Treating the rule
 * row as a whole-record override would report the wrong expected limit for
 * every field it leaves unset.
 */
export function resolveQuotaDefaults(
	global: IQuotaDefaultsRow | undefined,
	rule: IQuotaDefaultsRow | undefined,
): IQuotaDefaults {
	const positive = (v: number | undefined): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
	const out: IQuotaDefaults = {
		tenantTpm: positive(global?.defaultTenantTpm),
		userTpm: positive(global?.defaultUserTpm),
		vipTpm: positive(global?.vipSharedTpm),
	};
	if (!rule) return out;
	const override = (current: number, candidate: number | undefined): number => {
		const v = positive(candidate);
		return v > 0 ? v : current;
	};
	return {
		tenantTpm: override(out.tenantTpm, rule.defaultTenantTpm),
		userTpm: override(out.userTpm, rule.defaultUserTpm),
		vipTpm: override(out.vipTpm, rule.vipSharedTpm),
	};
}

export interface IEffectiveLimit {
	tpm: number;
	/** Where the number came from — an operator needs this to know what to edit. */
	source: 'explicit' | 'default';
}

/**
 * The limit a bucket in `scope` would be created with.
 *
 * Returns `undefined` when no limit resolves, which is exactly the condition
 * under which `quotaBucketsFor` creates no bucket and the collector therefore
 * exports nothing — so `undefined` here is the metric's expected absence,
 * derived from configuration rather than inferred from the empty exposition.
 *
 * ⚠️ Only the two AGGREGATE scopes fall through to the defaults. A per-model,
 * per-user-model or per-key limit that is unset stays unset: there is no
 * default for it anywhere in `quotaBucketsFor`. VIP is the mirror image — it
 * has no explicit entry at all and reads the default only.
 */
export function effectiveLimit(
	scope: QuotaScope,
	explicitTpm: number | undefined,
	defaults: IQuotaDefaults,
): IEffectiveLimit | undefined {
	const explicit = typeof explicitTpm === 'number' && Number.isFinite(explicitTpm) && explicitTpm > 0
		? explicitTpm
		: undefined;
	if (explicit !== undefined) return {tpm: explicit, source: 'explicit'};

	// ⚠️ VIP first: it is the one scope with no explicit entry, so asking
	// about fall-through would answer the wrong question for it.
	if (scope === 'vip') return defaults.vipTpm > 0 ? {tpm: defaults.vipTpm, source: 'default'} : undefined;
	if (!quotaScope(scope).fallsThroughToDefaults) return undefined;
	if (scope === 'tenant') return defaults.tenantTpm > 0 ? {tpm: defaults.tenantTpm, source: 'default'} : undefined;
	return defaults.userTpm > 0 ? {tpm: defaults.userTpm, source: 'default'} : undefined;
}

//---------------------------------------------------------
// Rows off the exposition
//---------------------------------------------------------

/** How a bucket stands against its bound. */
export type QuotaPressure =
	// Below the bound.
	| 'within'
	// At the bound: the next charge denies.
	| 'saturated'
	// ⚠️ Over the bound. NORMAL — a settled response put the bucket in
	// post-hoc debt. The next admission is denied until it refills.
	| 'in-debt';

/**
 * ⚠️ 1.0 is `saturated`, not `within`. The limiter denies once spend crosses
 * the bound, so an exactly-full bucket has no headroom left and an operator
 * reading "within quota" at 100% would be told the opposite of what happens
 * to the next request.
 */
export function quotaPressure(utilization: number): QuotaPressure {
	if (utilization > 1) return 'in-debt';
	if (utilization >= 1) return 'saturated';
	return 'within';
}

export interface IQuotaRow {
	scope: QuotaScope;
	labels: Readonly<Record<string, string>>;
	/** Never clamped. > 1 is post-hoc debt, not an error. */
	utilization: number;
	limitTokens: number;
	/**
	 * `limit * (1 - utilization)`, the gateway's own headroom formula from the
	 * limit gauge's HELP text. NEGATIVE while the bucket is in debt, and left
	 * that way deliberately: the magnitude is how far past the bound the
	 * settle went.
	 */
	headroomTokens: number;
	pressure: QuotaPressure;
}

/**
 * A series the exposition carries that cannot be turned into a row.
 *
 * ⭐ Both kinds are IMPOSSIBLE from `tokenQuotaCollector.Collect`, which is
 * what makes them worth reporting rather than skipping. The collector emits a
 * scope's utilization and its limit from the SAME loop iteration behind one
 * dedupe guard, and it `continue`s past any bucket whose `Limit <= 0` before
 * emitting anything. So an unpaired series or a non-positive limit is a
 * defect in the scrape, the parse or a future collector — never a state the
 * gateway can legitimately be in. This is 3.2's cross-family identity check
 * in the form where it IS computable: one snapshot, one writer, no timing.
 */
export interface IQuotaAnomaly {
	scope: QuotaScope;
	labels: Readonly<Record<string, string>>;
	kind: 'unpaired-series' | 'non-positive-limit';
}

export interface IQuotaScopeReading {
	scope: QuotaScope;
	/** Both families absent from the exposition. */
	absent: boolean;
	rows: readonly IQuotaRow[];
	anomalies: readonly IQuotaAnomaly[];
}

/** Identity of a bucket within a scope: its label values, in collector order. */
function bucketKey(sample: IMetricSample, labels: readonly string[]): string {
	return labels.map(l => sample.labels[l] ?? '').join(' ');
}

function labelsOf(sample: IMetricSample, labels: readonly string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const l of labels) out[l] = sample.labels[l] ?? '';
	return out;
}

/**
 * Join one scope's utilization and limit families into rows.
 *
 * ⚠️ Joins on the scope's DECLARED labels rather than on `labelKey`, because
 * the two families of a scope always carry the identical label set and a
 * future added label would otherwise silently split every pair into two
 * anomalies. An unexpected label is caught by the manifest's own label check,
 * not here.
 */
export function readQuotaScope(snapshot: IMetricsSnapshot | undefined, scope: QuotaScope): IQuotaScopeReading {
	const spec = quotaScope(scope);
	if (!snapshot || snapshot.failure) {
		return {scope, absent: true, rows: [], anomalies: []};
	}
	const utilFamily = snapshot.families.get(spec.utilization);
	const limitFamily = snapshot.families.get(spec.limit);
	if (utilFamily === undefined && limitFamily === undefined) {
		return {scope, absent: true, rows: [], anomalies: []};
	}

	const limits = new Map<string, IMetricSample>();
	for (const s of selectSamples(snapshot, spec.limit)) limits.set(bucketKey(s, spec.labels), s);

	const rows: IQuotaRow[] = [];
	const anomalies: IQuotaAnomaly[] = [];
	const paired = new Set<string>();

	for (const util of selectSamples(snapshot, spec.utilization)) {
		const key = bucketKey(util, spec.labels);
		const limit = limits.get(key);
		const labels = labelsOf(util, spec.labels);
		if (limit === undefined || !Number.isFinite(util.value) || !Number.isFinite(limit.value)) {
			anomalies.push({scope, labels, kind: 'unpaired-series'});
			continue;
		}
		paired.add(key);
		if (limit.value <= 0) {
			anomalies.push({scope, labels, kind: 'non-positive-limit'});
			continue;
		}
		rows.push({
			scope,
			labels,
			utilization: util.value,
			limitTokens: limit.value,
			headroomTokens: limit.value * (1 - util.value),
			pressure: quotaPressure(util.value),
		});
	}

	// A limit with no utilization is equally impossible, and equally worth
	// saying: it means the pair broke on the other side.
	for (const [key, limit] of limits) {
		if (!paired.has(key)) anomalies.push({scope, labels: labelsOf(limit, spec.labels), kind: 'unpaired-series'});
	}

	return {scope, absent: false, rows, anomalies};
}

//---------------------------------------------------------
// The verdict
//---------------------------------------------------------

export type QuotaVerdict =
	// ⭐ Live-verified on the testbed. No store is configured: quotas cannot
	// be set or enforced here, and the empty exposition is the whole truth.
	| 'not-configurable'
	// ⚠️⚠️ The store is configured and unreachable. Buckets drop out of
	// `quotaBucketsFor`, so nothing is being enforced RIGHT NOW and the empty
	// exposition looks identical to 'not-configurable'.
	| 'enforcement-offline'
	// Configuration is readable and resolves no limit anywhere the caller
	// could look. Nothing to enforce.
	| 'unconfigured'
	// A limit resolves but no bucket exists yet: nothing has been charged
	// since the last reap. The precondition, exactly as the manifest states it.
	| 'idle'
	// Buckets exist and are being metered.
	| 'active'
	// ⚠️ The configuration read did not answer and did not say why. 3.4's
	// fourth state: a "cannot know" is the honest output, never a default.
	| 'indeterminate';

export interface IQuotaReport {
	verdict: QuotaVerdict;
	storeState: QuotaStoreState;
	scopes: readonly IQuotaScopeReading[];
	rows: readonly IQuotaRow[];
	anomalies: readonly IQuotaAnomaly[];
	/**
	 * ⚠️ True when this node began enforcing on empty state with no peer
	 * warm-up. Independent of the verdict and never suppressed by it: quotas
	 * can be `active` and still have been cold-opened, which means a window of
	 * traffic went unmetered after the restart.
	 */
	coldOpened: boolean;
	/** Scopes whose absence is expected because no user identity can resolve. */
	userIdentityUnavailable: boolean;
}

export interface IQuotaReportInput {
	snapshot: IMetricsSnapshot | undefined;
	storeState: QuotaStoreState;
	/**
	 * Whether ANY limit the caller could resolve is positive. The caller
	 * resolves these with `effectiveLimit` over the identities it can actually
	 * enumerate — which is not all of them, so `false` means "none found",
	 * never "none exists".
	 */
	anyLimitResolves: boolean;
	/**
	 * Whether the gateway can attribute a user to a request at all, i.e. has
	 * a JWT auth profile bound. `false` makes the two user scopes'
	 * absence expected regardless of their configured limits.
	 */
	userIdentityAvailable: boolean;
}

/**
 * ⚠️⚠️ ORDER MATTERS AND IS NOT ARBITRARY: the store state is consulted
 * BEFORE the exposition, because the dangerous case is precisely the one
 * where the exposition is empty and looks fine. Reading the metric first and
 * only explaining an empty result afterwards is how a fail-open gets reported
 * as "no quotas configured" — the same ordering defect Stage 3.5 fixed when
 * it put the precondition check ahead of the activation code.
 *
 * The one exception is `active`: series on the wire prove the store answered
 * at scrape time, so they outrank a configuration read that failed for its
 * own reasons.
 */
export function quotaVerdict(input: IQuotaReportInput, hasRows: boolean): QuotaVerdict {
	if (hasRows) return 'active';
	switch (input.storeState) {
		case 'unconfigured':
			return 'not-configurable';
		case 'unavailable':
			return 'enforcement-offline';
		case 'unknown':
			return 'indeterminate';
		case 'readable':
			return input.anyLimitResolves ? 'idle' : 'unconfigured';
	}
}

export function tokenQuotaReport(input: IQuotaReportInput): IQuotaReport {
	const scopes = QUOTA_SCOPES.map(s => readQuotaScope(input.snapshot, s.scope));
	const rows = scopes.flatMap(s => s.rows);
	const anomalies = scopes.flatMap(s => s.anomalies);

	// ⭐ An eager, unlabelled `promauto` counter registered at package init, so
	// 0 is a REAL zero and absence means a build predating the family — which
	// is why absence reads false rather than being treated as "not cold".
	const coldOpenSamples = input.snapshot && !input.snapshot.failure
		? selectSamples(input.snapshot, TOKEN_QUOTA_COLD_OPEN)
		: [];
	const coldOpened = coldOpenSamples.some(s => Number.isFinite(s.value) && s.value > 0);

	return {
		verdict: quotaVerdict(input, rows.length > 0),
		storeState: input.storeState,
		scopes,
		rows,
		anomalies,
		coldOpened,
		userIdentityUnavailable: !input.userIdentityAvailable,
	};
}

/**
 * Why one scope has no rows, given the report.
 *
 * ⭐ Stage 3.5's `absenceReading` already answers "is absence expected?" from
 * the manifest for all twelve families — they are activation `Q` with a
 * precondition, so it returns `conditional` carrying the gateway's own prose.
 * This adds only what the manifest cannot know: which of the SIX scopes the
 * gateway's current configuration can ever populate. The two are complementary
 * and this must not restate the manifest's sentence.
 */
export type ScopeAbsence =
	// ⚠️ Cannot appear on this gateway at all: no user identity resolves.
	| 'no-user-identity'
	// Needs a charge on top of a configured limit.
	| 'awaiting-charge'
	// No limit resolves for this scope.
	| 'no-limit'
	// Absent for a reason this module cannot narrow.
	| 'unexplained';

export function scopeAbsence(
	scope: QuotaScope,
	report: Pick<IQuotaReport, 'userIdentityUnavailable'>,
	limitResolves: boolean,
): ScopeAbsence {
	const spec = quotaScope(scope);
	// ⚠️ Checked FIRST, and for the same reason 3.5 checks the precondition
	// before the activation code: a user-scoped family on an X-Api-Key-only
	// gateway is absent no matter what limit is configured, so reporting
	// "no limit" would send an operator to configure something that would
	// change nothing.
	if (spec.needsUserIdentity && report.userIdentityUnavailable) return 'no-user-identity';
	if (!limitResolves) return 'no-limit';
	if (spec.needsCharge) return 'awaiting-charge';
	return 'unexplained';
}
