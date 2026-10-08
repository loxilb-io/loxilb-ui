//---------------------------------------------------------
// confirm predicates ("did my write land?") per endpoint family.
//
// Two opposite mistakes are possible here and both are silent:
//
//   too LOOSE  → a sibling row satisfies the predicate and a write that never
//                landed is reported as confirmed. That is the false success
// exists to remove, reintroduced one layer down.
//   too TIGHT  → the gateway's own canonicalization (zero-valued fields come
//                back omitted, `[]` comes back `null`, optionals are defaulted
//                server-side, order is unstable) makes a landed write look
//                absent, and the operator is told "Submitted" about something
//                that is done (parent rule 6).
//
// The resolution is not one rule but two, because the two directions compare
// different things:
//
//   GONE (delete) — both sides are SERVER-shaped: the rows being deleted were
//   read from this same list. Canonicalization is therefore symmetric and the
//   full canonical identity is both safe and necessary. It is necessary
//   because the gateway legitimately serves rules that share VIP/port/protocol
//   and differ only by host, path, range or model — which is exactly why
//   canonicalLBRuleIdentity exists. Keying on VIP+port+protocol alone made a
//   completed delete look unconfirmed for as long as any peer survived
//   (caught by lb.spec.ts D-full-key).
//
//   APPEARED (create/update) — the submitted side is CLIENT-shaped, so the
//   full identity would compare fields the server is free to rewrite. Compare
//   only the fields the client actually SET: the key tuple, plus whichever
//   discriminators were specified. That is tight enough that a peer cannot
//   confirm someone else's write, and loose enough that a server default
//   cannot hide one.
//
//   APPLIED (create/update, by value) — being listed is not enough when the
//   row was there before the write: an existing rule, tenant, user or profile
//   satisfies APPEARED however stale its values are. An APPLIED predicate
//   also compares what was sent, each field the way its endpoint returns it.
//   The rule one lives in lbRuleApplied.ts; the rest are below.
//
// What each confirmation reads. A confirmation is a read of the target of the
// write and nothing wider, so an operator can tell which state it touched:
//
//   LB rule create / update / delete      GET /config/loadbalancer/all
//   endpoint create / delete              GET /config/endpoint/all
//   API key create                        GET /config/ai/apikey/{key_id} — that
//                                         key only, field by field; then the
//                                         list once
//   API key patch / delete                GET /config/ai/apikey
//   tenant quota upsert                   GET /config/ai/tenant/ratelimit/{tenant_id}
//                                         — that tenant only; the table's own
//                                         read of the tenants already on screen
//                                         follows once, afterwards
//   user quota upsert                     GET /config/ai/user/ratelimit/{tenant_id}/{user_id}
//                                         — that user only; then the tenant's
//                                         user list once
//   user quota delete                     GET /config/ai/user/ratelimit/{tenant_id}
//   quota defaults upsert / delete        GET /config/ai/ratelimit/defaults/{scope}
//                                         for the rows already on screen
//   JWT profile upsert / delete           GET /config/ai/jwtauthprofile
//
// None of them reads a tenant, user, rule or profile other than the one that
// was written, apart from the list the page was already showing. None of them
// observes the data plane: a confirmed write is stored configuration, not an
// installed policy and not a served request.
//---------------------------------------------------------
import {ITenantRateLimitMod, IUserRateLimitMod, apiKeyExpiry, normalizeTenantRateLimit, normalizeUserRateLimit} from 'types/ai';
import {IJWTAuthProfileEntry, JWT_PROFILE_DEFAULTS} from 'types/ai_jwt';
import {IEndpointItem} from 'types/endpoint';
import {canonicalLBRuleIdentity} from 'types/lb_identity';
import {IServiceArguments, IServiceConfiguration} from 'types/load_balancer';

//---------------------------------------------------------
// Load balancer rules
//---------------------------------------------------------

/** Every rule the operator deleted is gone (server-shaped on both sides). */
export const lbRulesGone =
	(deleted: IServiceConfiguration[]) =>
	(rows: IServiceConfiguration[]): boolean => {
		const present = new Set(rows.map(canonicalLBRuleIdentity));
		return deleted.every(d => !present.has(canonicalLBRuleIdentity(d)));
	};

/** Discriminators, included only when the client actually set them. */
const LB_DISCRIMINATORS = ['name', 'host', 'path_prefix', 'model_name'] as const;

/** The rule the operator created/updated is present. */
export const lbRuleAppeared =
	(submitted: IServiceConfiguration) =>
	(rows: IServiceConfiguration[]): boolean => {
		const want = submitted.serviceArguments;
		const set = LB_DISCRIMINATORS.filter(f => {
			const v = want[f as keyof IServiceArguments];
			return typeof v === 'string' && v.length > 0;
		});
		return rows.some(r => {
			const got = r.serviceArguments;
			if ((got.externalIP ?? '') !== (want.externalIP ?? '')) return false;
			if (got.port !== want.port) return false;
			if ((got.protocol ?? '').toLowerCase() !== (want.protocol ?? '').toLowerCase()) return false;
			return set.every(f => got[f as keyof IServiceArguments] === want[f as keyof IServiceArguments]);
		});
	};

//---------------------------------------------------------
// Endpoints
//---------------------------------------------------------

/**
 * The same composite the endpoint table uses for row identity — a host can
 * carry several endpoints that differ by name, probe port or probe type.
 */
const epIdentity = (item: {name?: string; hostName?: string; probePort?: number; probeType?: string}): string =>
	[item.name ?? '', item.hostName ?? '', item.probePort ?? '', item.probeType ?? ''].join('|');

export const endpointsGone =
	(deleted: IEndpointItem[]) =>
	(rows: IEndpointItem[]): boolean => {
		const present = new Set(rows.map(epIdentity));
		return deleted.every(d => !present.has(epIdentity(d)));
	};

/**
 * `name` is optional on submission and assigned by the gateway when omitted,
 * so it joins the comparison only when the operator supplied it.
 */
export const endpointAppeared =
	(submitted: {hostName: string; name?: string}) =>
	(rows: IEndpointItem[]): boolean =>
		rows.some(r => (r.hostName ?? '') === submitted.hostName && (!submitted.name || r.name === submitted.name));

//---------------------------------------------------------
// Shared canonical forms for the quota reads
//---------------------------------------------------------

/** A count as the quota endpoints mean it: absent, null and 0 are one value. */
const sameCount = (asked: number | null | undefined, served: number | null | undefined): boolean => (asked ?? 0) === (served ?? 0);

type ModelQuotaRow = {model?: string; tokens_per_min?: number | null} | null;

/**
 * Model quotas as a map, so order never matters. A row that is not a positive
 * quota is no quota on these endpoints (zero removes it) and is left out —
 * unless `keepRemovals` asks for it as an explicit 0, which is how a tenant
 * upsert names a model it wants removed.
 */
function modelQuotas(rows: readonly ModelQuotaRow[] | null | undefined, keepRemovals = false): Map<string, number> {
	const out = new Map<string, number>();
	for (const row of rows ?? []) {
		const model = (row?.model ?? '').trim();
		if (model === '') continue;
		const tpm = row?.tokens_per_min ?? 0;
		if (tpm > 0) out.set(model, tpm);
		else if (keepRemovals) out.set(model, 0);
		else out.delete(model);
	}
	return out;
}

type ServedTenantRateLimit = {tenant_id?: string; rps?: number | null; tokens_per_min?: number | null; burst_pct?: number | null; model_limits?: ModelQuotaRow[] | null};
type ServedUserRateLimit = {tenant_id?: string; user_id?: string; rps?: number | null; burst_size?: number | null; tokens_per_min?: number | null; model_limits?: ModelQuotaRow[] | null};

//---------------------------------------------------------
// AI API keys / tenant rate limits
//---------------------------------------------------------

/**
 * API keys are identified by the gateway-issued `key_id`, which the create
 * response carries — so confirmation here is exact, with no near-miss risk.
 */
export const apiKeyAppeared =
	(keyId: string) =>
	(rows: {key_id?: string}[]): boolean =>
		rows.some(r => r.key_id === keyId);

/**
 * What a new API key reads back differently from what was asked for: the
 * names of the fields that differ, empty when none does.
 *
 * Every field of the create body is compared, since a create asserts all of
 * them, each the way the summary serves it:
 *   - a zero limit, an empty name and an empty model list can all be absent;
 *   - `enabled` left out of the request means enabled;
 *   - an expiry left out, or the Unix epoch, means no expiry, and the summary
 *     serves no expiry as the year-1 zero time rather than leaving the field
 *     out (`apiKeyExpiry`); a stored expiry is compared to the second (how
 *     exactly the store keeps a fraction of a second was not read, so one is
 *     not held against it).
 * The secret is not compared: no read returns it.
 */
export const API_KEY_CREATE_FIELDS = ['tenant_id', 'name', 'allowed_models', 'rate_limit_rps', 'burst_size', 'tokens_per_min', 'expires_at', 'enabled'] as const;
export type ApiKeyCreateField = (typeof API_KEY_CREATE_FIELDS)[number];

type ApiKeyAsked = {tenant_id?: string; name?: string; allowed_models?: string[]; rate_limit_rps?: number; burst_size?: number; tokens_per_min?: number; expires_at?: string; enabled?: boolean | null};
type ApiKeyServed = {tenant_id?: string; name?: string; allowed_models?: string[] | null; rate_limit_rps?: number | null; burst_size?: number | null; tokens_per_min?: number | null; expires_at?: string | null; enabled?: boolean};

// Whole seconds since the epoch; 0 for no expiry. NaN for text that is no time.
const expirySeconds = (value: string | null | undefined): number => {
	const expiry = apiKeyExpiry(value);
	return expiry === undefined ? 0 : Math.floor(Date.parse(expiry) / 1000);
};

export function apiKeyCreateDiff(asked: ApiKeyAsked, served: ApiKeyServed): ApiKeyCreateField[] {
	const same: Record<ApiKeyCreateField, boolean> = {
		tenant_id: (asked.tenant_id ?? '') === (served.tenant_id ?? ''),
		name: (asked.name ?? '') === (served.name ?? ''),
		allowed_models: (asked.allowed_models ?? []).join(',') === (served.allowed_models ?? []).join(','),
		rate_limit_rps: (asked.rate_limit_rps ?? 0) === (served.rate_limit_rps ?? 0),
		burst_size: (asked.burst_size ?? 0) === (served.burst_size ?? 0),
		tokens_per_min: (asked.tokens_per_min ?? 0) === (served.tokens_per_min ?? 0),
		expires_at: expirySeconds(asked.expires_at) === expirySeconds(served.expires_at),
		enabled: (asked.enabled ?? true) === (served.enabled !== false),
	};
	return API_KEY_CREATE_FIELDS.filter(field => !same[field]);
}

export const apiKeysGone =
	(deletedKeyIds: string[]) =>
	(rows: {key_id?: string}[]): boolean => {
		const present = new Set(rows.map(r => r.key_id));
		return deletedKeyIds.every(id => !present.has(id));
	};

/**
 * A tenant upsert landed: the tenant's own read now carries what was sent.
 *
 * The read is the INDIVIDUAL `GET …/tenant/ratelimit/{tenant_id}`, so `null`
 * (its 404) means the entry is not there and never confirms.
 *
 * The two halves of the body have different write semantics, and each is
 * compared the way it was written:
 *
 *   rps, tokens_per_min, burst_pct — REPLACED by every POST ("omission becomes
 *   zero"), and stored as sent. All three are compared, absent equal to 0 on
 *   both sides.
 *
 *   model_limits — each supplied row is its own upsert or removal, and a model
 *   the body does not name is left alone. So only the NAMED models are
 *   compared: a positive quota must read back equal, a zero (the tombstone an
 *   edit appends for a removed row) must read back absent. A model this write
 *   never mentioned is someone else's state and is not looked at.
 */
export const tenantRateLimitApplied =
	(submitted: ITenantRateLimitMod) =>
	(served: ServedTenantRateLimit | null): boolean => {
		const want = normalizeTenantRateLimit(submitted);
		if (!served || served.tenant_id !== want.tenant_id) return false;
		if (!sameCount(want.rps, served.rps)) return false;
		if (!sameCount(want.tokens_per_min, served.tokens_per_min)) return false;
		if (!sameCount(want.burst_pct, served.burst_pct)) return false;

		const servedQuota = modelQuotas(served.model_limits);
		// Rows are applied in order and the last one wins, so the last row for
		// a model is the one that was asked for.
		return Array.from(modelQuotas(want.model_limits, true)).every(([model, asked]) => (servedQuota.get(model) ?? 0) === asked);
	};

/**
 * A patch landed on an API key: every field the operator actually CHANGED now
 * reads back that way (Stage 4.1).
 *
 * ⚠️⚠️ THE CANONICALIZATION IS THE WHOLE POINT HERE, and it is the "too tight"
 * failure this file's header warns about, in its sharpest form. `ApiKeySummary`
 * says outright that "optional zero metadata can be absent" — so setting a
 * rate field to 0, which is an explicit and meaningful limit on this endpoint,
 * can read back as a MISSING FIELD. A predicate comparing `row.rate_limit_rps
 * === 0` would therefore never confirm the one edit most likely to be made
 * (lifting a limit), and the operator would be told a completed change had not
 * landed. Absent and 0 are compared as equal for exactly that reason.
 *
 * ⚠️ `allowed_models: []` can likewise come back as `null`, and `enabled` is
 * the only field guaranteed to serialize.
 *
 * ⭐ Only the fields the patch NAMED are compared — the rest were explicitly
 * left unchanged, so comparing them would test someone else's state.
 */
export const apiKeyPatchApplied =
	(keyId: string, patch: {allowed_models?: string[]; enabled?: boolean; rate_limit_rps?: number; burst_size?: number; tokens_per_min?: number}) =>
	(rows: {key_id?: string; allowed_models?: string[] | null; enabled?: boolean; rate_limit_rps?: number | null; burst_size?: number | null; tokens_per_min?: number | null}[]): boolean => {
		const row = rows.find(r => r.key_id === keyId);
		if (!row) return false;

		const numericMatches = (asked: number | undefined, served: number | null | undefined): boolean =>
			asked === undefined || asked === (served ?? 0);

		if (!numericMatches(patch.rate_limit_rps, row.rate_limit_rps)) return false;
		if (!numericMatches(patch.burst_size, row.burst_size)) return false;
		if (!numericMatches(patch.tokens_per_min, row.tokens_per_min)) return false;

		if (patch.enabled !== undefined && patch.enabled !== (row.enabled !== false)) return false;

		if (patch.allowed_models !== undefined) {
			if (patch.allowed_models.join(',') !== (row.allowed_models ?? []).join(',')) return false;
		}

		return true;
	};

//---------------------------------------------------------
// Per-user rate limits (Stage 4.2)
//---------------------------------------------------------
// The list is scoped to one tenant and its rows carry NO model limits, so it
// can prove that an entry is gone but not what an entry holds. An upsert is
// therefore confirmed on the per-user read, a delete on the list.

/**
 * A user upsert landed: the user's own read now carries what was sent.
 *
 * The POST replaces the entry AND its model rows as a set, so everything in
 * the body was asserted by this write: the three aggregate fields are compared
 * (absent equal to 0 — a zero field falls through the ladder and is stored as
 * sent), and the model quotas must match as a whole set, in any order. A model
 * row left over from before the write means the replace did not land.
 */
export const userRateLimitApplied =
	(submitted: IUserRateLimitMod) =>
	(served: ServedUserRateLimit | null): boolean => {
		const want = normalizeUserRateLimit(submitted);
		if (!served || served.user_id !== want.user_id || served.tenant_id !== want.tenant_id) return false;
		if (!sameCount(want.rps, served.rps)) return false;
		if (!sameCount(want.burst_size, served.burst_size)) return false;
		if (!sameCount(want.tokens_per_min, served.tokens_per_min)) return false;

		const asked = modelQuotas(want.model_limits);
		const got = modelQuotas(served.model_limits);
		return asked.size === got.size && Array.from(asked).every(([model, tpm]) => got.get(model) === tpm);
	};

/**
 * The user's explicit entry is gone, so they have fallen back to the
 * configured defaults. Absence IS the confirmation here.
 */
export const userRateLimitGone =
	(userId: string) =>
	(rows: {user_id?: string}[]): boolean =>
		!rows.some(r => r.user_id === userId);

//---------------------------------------------------------
// Rate-limit defaults (Stage 4.2b)
//---------------------------------------------------------
// scope+service is the key: the global row and a rule row are different rows,
// and two rule rows differ only by service.

const sameDefaultsRow = (scope: string, ruleIdent: string | undefined) =>
	(row: {scope?: string; rule_ident?: string}): boolean =>
		row.scope === scope && (row.rule_ident ?? '') === (ruleIdent ?? '');

/**
 * A defaults row was written and now reads back as asked.
 *
 * ⚠️⚠️ ABSENT IS COMPARED EQUAL TO ZERO, and on this endpoint that is not a
 * tolerance but the contract: a zero field FALLS THROUGH, and the gateway
 * omits it from the read-back entirely. Verified live — after posting a row
 * with one positive field, the GET carried that field alone and none of the
 * other five. A predicate demanding `row.default_user_rps === 0` would
 * therefore never confirm any row, since a row with all six positive is
 * exactly the row the gateway refuses.
 *
 * ⭐ All six fields are compared, not just the changed one, because the POST
 * REPLACES the row: every field was asserted by this write, so every field is
 * evidence about whether it landed.
 */
export const rateLimitDefaultsApplied =
	(mod: {
		scope: string;
		rule_ident?: string;
		default_user_rps?: number;
		default_user_tpm?: number;
		default_tenant_rps?: number;
		default_tenant_tpm?: number;
		vip_shared_rps?: number;
		vip_shared_tpm?: number;
	}) =>
	(rows: {scope?: string; rule_ident?: string; default_user_rps?: number | null; default_user_tpm?: number | null; default_tenant_rps?: number | null; default_tenant_tpm?: number | null; vip_shared_rps?: number | null; vip_shared_tpm?: number | null}[]): boolean => {
		const row = rows.find(sameDefaultsRow(mod.scope, mod.rule_ident));
		if (!row) return false;
		const matches = (asked: number | undefined, served: number | null | undefined): boolean => (asked ?? 0) === (served ?? 0);
		return matches(mod.default_user_rps, row.default_user_rps)
			&& matches(mod.default_user_tpm, row.default_user_tpm)
			&& matches(mod.default_tenant_rps, row.default_tenant_rps)
			&& matches(mod.default_tenant_tpm, row.default_tenant_tpm)
			&& matches(mod.vip_shared_rps, row.vip_shared_rps)
			&& matches(mod.vip_shared_tpm, row.vip_shared_tpm);
	};

/**
 * The defaults row is gone, so the identities it governed now fall through to
 * the next ladder level. Absence IS the confirmation.
 */
export const rateLimitDefaultsGone =
	(scope: string, ruleIdent?: string) =>
	(rows: {scope?: string; rule_ident?: string}[]): boolean =>
		!rows.some(sameDefaultsRow(scope, ruleIdent));

//---------------------------------------------------------
// JWT auth profiles
//---------------------------------------------------------
// The POST is create-or-replace of the WHOLE entry, so every field is asserted
// by the write and every field is compared.
//
// "Absent" and "the documented default" are one configuration on this entry —
// the contract says so outright ("zero or absent numeric fields select the
// documented defaults; there is no field where zero is a meaningful
// non-default") — so both sides are reduced to the value the gateway would
// act on before they are compared. That keeps a profile sent without
// `leeway_sec` equal to one read back with 0, with nothing, or with 30.
//
// Two fields have NO default to fold into, because empty is itself a
// security-relevant setting: empty `audiences` skips the audience check and
// empty `default_tenant` denies tokens with no tenant claim. They are compared
// as they stand, with `null` (a nil Go slice) equal to `[]` and nothing else.

const sortedList = (list: readonly string[] | null | undefined): string => JSON.stringify([...(list ?? [])].sort());

/** A profile reduced to what the gateway acts on, as one comparable string. */
function effectiveJwtProfile(profile: IJWTAuthProfileEntry): string {
	const text = (value: string | undefined, fallback = ''): string => {
		const trimmed = (value ?? '').trim();
		return trimmed === '' ? fallback : trimmed;
	};
	const seconds = (value: number | undefined, fallback: number): number => (typeof value === 'number' && value > 0 ? value : fallback);
	const algs = profile.algs ?? [];
	return JSON.stringify([
		text(profile.name),
		text(profile.issuer),
		text(profile.jwks_url),
		sortedList(profile.audiences),
		sortedList(algs.length > 0 ? algs : JWT_PROFILE_DEFAULTS.algs),
		seconds(profile.leeway_sec, JWT_PROFILE_DEFAULTS.leeway_sec),
		seconds(profile.refresh_sec, JWT_PROFILE_DEFAULTS.refresh_sec),
		text(profile.tenant_claim, JWT_PROFILE_DEFAULTS.tenant_claim),
		text(profile.user_claim, JWT_PROFILE_DEFAULTS.user_claim),
		text(profile.models_claim),
		text(profile.roles_claim, JWT_PROFILE_DEFAULTS.roles_claim),
		text(profile.model_role_prefix, JWT_PROFILE_DEFAULTS.model_role_prefix),
		text(profile.username_claim, JWT_PROFILE_DEFAULTS.username_claim),
		text(profile.model_authz, JWT_PROFILE_DEFAULTS.model_authz),
		profile.default_tenant ?? '',
		profile.forward_identity === true,
		profile.authorization_passthrough === true,
	]);
}

/** The profile reads back under its name with the configuration that was sent. */
export const jwtProfileApplied =
	(submitted: IJWTAuthProfileEntry) =>
	(rows: IJWTAuthProfileEntry[]): boolean => {
		const name = (submitted.name ?? '').trim();
		const row = rows.find(r => r.name === name);
		return row !== undefined && effectiveJwtProfile(row) === effectiveJwtProfile(submitted);
	};

/** No profile is listed under exactly this name. Absence IS the confirmation. */
export const jwtProfileGone =
	(name: string) =>
	(rows: {name?: string}[]): boolean =>
		!rows.some(r => r.name === name);
