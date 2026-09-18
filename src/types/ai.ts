//---------------------------------------------------------
// AI Gateway Types (API keys + tenant rate limits)
//
// Derived from the vendored gateway swagger (src/api/gen/gateway.ts)
// so they cannot drift from the live API contract.
//---------------------------------------------------------
import type {GwSchema} from 'api';

// POST /config/ai/apikey request body
export type IApiKeyCreateRequest = GwSchema<'ApiKeyCreateRequest'>;

// POST /config/ai/apikey 201 body. Generated mode returns raw_key once;
// import mode deliberately omits it.
export type IApiKeyCreateResponse = GwSchema<'ApiKeyCreateResponse'>;

// GET /config/ai/apikey list element
export type IApiKeySummary = GwSchema<'ApiKeySummary'>;

// POST /config/ai/tenant/ratelimit body (upsert)
export type ITenantRateLimitMod = GwSchema<'TenantRateLimitMod'>;

export type ITenantModelRateLimit = GwSchema<'TenantModelRateLimit'>;

// GET /config/ai/tenant/ratelimit/{tenant_id} body
export type ITenantRateLimitEntry = GwSchema<'TenantRateLimitEntry'>;

// GET /config/ai/ratelimit/defaults/{scope} body — one row of the QoS ladder.
//
// ⚠️ A 'rule' row OVERRIDES the 'global' row FIELD-WISE and only where its
// value is positive (`resolveQoSDefaults`, ai_gateway_dp.go:107), so it is not
// a replacement record. Resolve the pair with `resolveQuotaDefaults` rather
// than reading either row alone.
export type IRateLimitDefaultsEntry = GwSchema<'RateLimitDefaultsEntry'>;

function isNonNegativeSafeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Reconcile the model rows currently shown in an edit form with the model
 * quotas that were persisted when the form opened.
 *
 * The gateway upsert does not replace the model collection: a missing model
 * is left unchanged, while an explicit zero removes it. Consequently an edit
 * must append zero-valued tombstones for persisted models that disappeared
 * from the current draft (including the old name of a renamed row).
 */
export function reconcileTenantModelLimits(
	current: ITenantModelRateLimit[] = [],
	persisted: ITenantModelRateLimit[] = [],
): ITenantModelRateLimit[] {
	const currentModels = new Set(
		current
			.map(limit => limit.model?.trim() ?? '')
			.filter(model => model.length > 0),
	);
	const tombstonedModels = new Set<string>();
	const tombstones: ITenantModelRateLimit[] = [];

	for (const limit of persisted) {
		const model = limit.model?.trim() ?? '';
		if (!model || currentModels.has(model) || tombstonedModels.has(model)) continue;
		tombstonedModels.add(model);
		tombstones.push({model, tokens_per_min: 0});
	}

	return [...current, ...tombstones];
}

export function normalizeTenantRateLimit(data: ITenantRateLimitMod): ITenantRateLimitMod {
	const {model_limits, ...tenantLimit} = data;
	return {
		...tenantLimit,
		tenant_id: data.tenant_id.trim(),
		...(model_limits?.length
			? {model_limits: model_limits.map(limit => ({
				model: limit.model?.trim(),
				tokens_per_min: limit.tokens_per_min,
			}))}
			: {}),
	};
}

export function validateTenantRateLimit(data: ITenantRateLimitMod): string[] {
	const normalized = normalizeTenantRateLimit(data);
	const errors: string[] = [];
	if (!normalized.tenant_id) errors.push('Tenant ID is required.');
	if (normalized.rps !== undefined && !isNonNegativeSafeInteger(normalized.rps)) {
		errors.push('Tenant RPS must be a non-negative integer.');
	}
	if (normalized.tokens_per_min !== undefined && !isNonNegativeSafeInteger(normalized.tokens_per_min)) {
		errors.push('Tenant tokens per minute must be a non-negative integer.');
	}
	if (
		normalized.burst_pct !== undefined
		&& (!isNonNegativeSafeInteger(normalized.burst_pct) || normalized.burst_pct > 1000)
	) {
		errors.push('Tenant burst percentage must be 0 or an integer between 1 and 1000.');
	}

	const seen = new Set<string>();
	for (const [index, limit] of (normalized.model_limits ?? []).entries()) {
		const model = limit.model ?? '';
		if (!model) errors.push(`Model quota row ${index + 1} requires a model name.`);
		else if (seen.has(model)) errors.push(`Model quota ${model} is duplicated.`);
		else seen.add(model);
		if (!isNonNegativeSafeInteger(limit.tokens_per_min)) {
			errors.push(`Model quota row ${index + 1} tokens per minute must be a non-negative integer.`);
		}
	}
	return errors;
}

//---------------------------------------------------------
// PATCH /config/ai/apikey/{key_id} body (Stage 4.1)
//---------------------------------------------------------
// ⚠️⚠️ NOT a `GwSchema`, and deliberately so. The generated swagger's PATCH
// entry is a marked stub (`x-raw-middleware: true`) whose body is declared as
// a bare `type: object` precisely so the two documents cannot disagree about
// the field set — the served contract lives in
// `api-spec/gateway-swagger-extras.yml`. So this interface IS the UI's copy of
// that contract; when the extras file moves, move this with it.
//
// ⭐⭐ THE FIELD SET IS FIVE, not the three rate-limit fields the task brief
// names. `allowed_models` and `enabled` are patchable on the same call and
// share the same presence rules, which matters because they are written by a
// SEPARATE, non-transactional statement (see below).
//
// ⭐⭐ PRESENCE IS THE INTENT, AND IT INVERTS THE CREATE FORM'S CONVENTION.
// On create (`apiKeyFormToRequest`) a rate field of 0 is expressed BY
// OMISSION, because omitted means "apply the gateway default". On PATCH the
// same two states mean opposite things:
//
//   omitted / null  leave the stored value UNCHANGED
//   0               an explicit limit of zero — "no per-key request limit"
//                   for `rate_limit_rps`, "no per-key token quota" for
//                   `tokens_per_min`, and for `burst_size` a fall back to
//                   `rate_limit_rps` as the bucket capacity
//
// ⇒ A cleared input must send NOTHING and a typed 0 must send 0. Reusing the
// create projection here would silently turn "set this key to unlimited" into
// "change nothing", which is the one mistake that looks like success.
//
// ⚠️ At least one of the five must be present. A body naming none of them is
// refused 400 BEFORE the key is looked up — so that 400 does not mean the key
// exists. `apiKeyPatchIsEmpty` exists to keep that request off the wire
// entirely; see the connector for why that narrowing is worth having.
export interface IApiKeyPatch {
	allowed_models?: string[];
	enabled?: boolean;
	rate_limit_rps?: number;
	burst_size?: number;
	tokens_per_min?: number;
}

// The five patchable field names, in the contract's own order. Exported so the
// emptiness check and its tests cannot drift apart from the interface.
export const API_KEY_PATCH_FIELDS = ['allowed_models', 'enabled', 'rate_limit_rps', 'burst_size', 'tokens_per_min'] as const;

/**
 * Whether this body asks for nothing, by the gateway's own definition of the
 * class: an empty object, and a body whose every patchable member is
 * explicitly null/undefined.
 *
 * ⚠️ An explicit EMPTY ARRAY on `allowed_models` is NOT in this class — it is a
 * present field that clears the model restriction, which is a real change and
 * must reach the gateway.
 */
export function apiKeyPatchIsEmpty(patch: IApiKeyPatch | null | undefined): boolean {
	if (!patch) return true;
	return !API_KEY_PATCH_FIELDS.some(field => patch[field] !== undefined && patch[field] !== null);
}

/**
 * Client-side validation of a patch body. Returns English source strings, the
 * same convention as `validateTenantRateLimit`.
 *
 * ⚠️ The gateway performs NO model-name validation on this path — it stores the
 * list as comma-separated text, so `["a,b"]` becomes two names and `[""]`
 * becomes an unrestricted list. Those are lossy storage cases, not supported
 * semantics, so the UI refuses them here rather than letting an operator
 * discover the corruption later.
 */
export function validateApiKeyPatch(patch: IApiKeyPatch): string[] {
	const errors: string[] = [];

	if (apiKeyPatchIsEmpty(patch)) {
		errors.push('Change at least one field before applying.');
		return errors;
	}

	const rateFields: [keyof IApiKeyPatch, string][] = [
		['rate_limit_rps', 'Requests per second must be a non-negative integer.'],
		['burst_size', 'Burst size must be a non-negative integer.'],
		['tokens_per_min', 'Tokens per minute must be a non-negative integer.'],
	];
	for (const [field, message] of rateFields) {
		const value = patch[field];
		if (value !== undefined && !isNonNegativeSafeInteger(value)) errors.push(message);
	}

	const models = patch.allowed_models;
	if (models !== undefined) {
		// An empty array is legal (it clears the restriction); an array with
		// unusable ITEMS is not.
		const seen = new Set<string>();
		for (const model of models) {
			if (typeof model !== 'string' || model.trim().length === 0) {
				errors.push('A model name cannot be empty.');
			} else if (model.includes(',')) {
				// The gateway joins the list with commas and splits on them, so
				// a comma inside a name silently becomes two names.
				errors.push('A model name cannot contain a comma.');
			} else if (seen.has(model)) {
				errors.push(`Model ${model} is duplicated.`);
			} else {
				seen.add(model);
			}
		}
	}

	return errors;
}

//---------------------------------------------------------
// Per-user rate limits (/config/ai/user/ratelimit) — Stage 4.2
//---------------------------------------------------------
// Level 1 of the gateway's QoS ladder. `DELETE` on a user makes them fall
// back to the configured defaults, then to unlimited — so an explicit entry
// is an override, never the only thing standing between a user and no limit.

export type IUserRateLimitMod = GwSchema<'UserRateLimitMod'>;
export type IUserRateLimitEntry = GwSchema<'UserRateLimitEntry'>;
export type IUserModelRateLimit = GwSchema<'UserModelRateLimit'>;

// ⚠️⚠️ A THIRD ZERO SEMANTIC IN THIS ONE FEATURE AREA. Keep them apart:
//
//   create an API key       0 is expressed BY OMISSION and means "apply the
//                           gateway default"
//   PATCH an API key        0 is an EXPLICIT limit of zero, i.e. no limit
//   POST a user's limits    0 "constrains nothing and falls through to the
//                           configured defaults" — it is INHERITANCE, not
//                           "unlimited", and an entry whose limits are all
//                           zero is REFUSED rather than stored
//
// So an operator who types 0 everywhere here has asked for nothing and gets a
// 400. Verified live: the gateway answers
// "a user rate-limit entry must set at least one non-zero limit (zero falls
// through the ladder; use DELETE to remove limits)".

/**
 * The sync-wire scope prefixes an identity may not begin with, copied from
 * `ratelimit.ReservedIdentityScopePrefixes` (`pkg/ratelimit/ratelimit_sync.go:132`).
 *
 * ⭐ These exist because bucket keys are composed by prefixing a scope: a user
 * named `uq:x` would round-trip through the wire mapping into ANOTHER scope's
 * bucket. `ver:` is in the set because it is the scope-version sentinel key.
 *
 * ⚠️ Mirrored here only to refuse the value before it is sent; the gateway is
 * the authority and rejects it too (400 with the offending field named).
 */
export const RESERVED_QOS_IDENTITY_PREFIXES = ['k:', 'u:', 't:', 'tm:', 'uq:', 'um:', 'kq:', 'v:', 'ver:'] as const;

/**
 * Why a QoS identity (tenant, user or model) cannot be used, or undefined.
 * Returns an English source string, the convention in this file.
 */
export function qosIdentityError(id: string | undefined): string | undefined {
	const value = (id ?? '').trim();
	if (value.length === 0) return 'An identifier is required.';
	// '|' is the composite bucket-key delimiter, so an identity containing it
	// could alias a different bucket entirely.
	if (value.includes('|')) return 'An identifier cannot contain "|", which the gateway uses to compose bucket keys.';
	if (RESERVED_QOS_IDENTITY_PREFIXES.some(p => value.startsWith(p))) {
		return 'An identifier cannot begin with a reserved rate-limit scope prefix (k: u: t: tm: uq: um: kq: v: ver:).';
	}
	return undefined;
}

export function normalizeUserRateLimit(data: IUserRateLimitMod): IUserRateLimitMod {
	const models = (data.model_limits ?? [])
		.map(m => ({...m, model: (m.model ?? '').trim()}))
		.filter(m => m.model.length > 0);
	return {
		...data,
		tenant_id: (data.tenant_id ?? '').trim(),
		user_id: (data.user_id ?? '').trim(),
		// ⚠️ `model_limits` is REPLACE-AS-A-SET, and an omitted/empty list
		// CLEARS the user's model rows. So an empty array is meaningful and is
		// preserved rather than dropped.
		model_limits: models,
	};
}

/**
 * Whether this entry constrains nothing, which is the gateway's own rejection
 * rule rather than a UI preference.
 *
 * ⭐⭐ A POSITIVE MODEL QUOTA COUNTS AS A LIMIT. The swagger's "an entry whose
 * limit fields are all zero is rejected" does not say whether `model_limits`
 * are limit fields, so it was settled against the running gateway: an entry
 * with rps/burst/tpm all 0 AND one model row at 100 tokens/min is ACCEPTED
 * (204). Treating it as empty here would refuse something the gateway stores.
 */
export function userRateLimitIsAllZero(data: IUserRateLimitMod): boolean {
	const normalized = normalizeUserRateLimit(data);
	const scalarsZero = !(normalized.rps || normalized.burst_size || normalized.tokens_per_min);
	const anyModelLimit = (normalized.model_limits ?? []).some(m => (m.tokens_per_min ?? 0) > 0);
	return scalarsZero && !anyModelLimit;
}

export function validateUserRateLimit(data: IUserRateLimitMod): string[] {
	const normalized = normalizeUserRateLimit(data);
	const errors: string[] = [];

	const tenantError = qosIdentityError(normalized.tenant_id);
	if (tenantError) errors.push(`Tenant: ${tenantError}`);
	const userError = qosIdentityError(normalized.user_id);
	if (userError) errors.push(`User: ${userError}`);

	const scalars: [number | undefined, string][] = [
		[normalized.rps, 'User requests per second must be a non-negative integer.'],
		[normalized.burst_size, 'User burst size must be a non-negative integer.'],
		[normalized.tokens_per_min, 'User tokens per minute must be a non-negative integer.'],
	];
	for (const [value, message] of scalars) {
		if (value !== undefined && !isNonNegativeSafeInteger(value)) errors.push(message);
	}

	const seen = new Set<string>();
	for (const [index, limit] of (normalized.model_limits ?? []).entries()) {
		const model = limit.model ?? '';
		const modelError = qosIdentityError(model);
		if (modelError) errors.push(`Model quota row ${index + 1}: ${modelError}`);
		else if (seen.has(model)) errors.push(`Model quota ${model} is duplicated.`);
		else seen.add(model);
		if (!isNonNegativeSafeInteger(limit.tokens_per_min)) {
			errors.push(`Model quota row ${index + 1} tokens per minute must be a non-negative integer.`);
		}
	}

	// ⚠️ Checked LAST so a malformed identity is reported as itself rather than
	// as "nothing to save", and only when nothing else is already wrong.
	if (errors.length === 0 && userRateLimitIsAllZero(normalized)) {
		errors.push('Set at least one non-zero limit. A zero falls through to the configured defaults, so an all-zero entry asks for nothing — delete the entry instead to fall back to the defaults.');
	}

	return errors;
}

//---------------------------------------------------------
// Rate-limit defaults (/config/ai/ratelimit/defaults) — Stage 4.2b
//---------------------------------------------------------
// Level 3 of the QoS ladder: the row an identity falls through to when it has
// no explicit entry of its own. Two scopes, and the `rule` row overrides the
// `global` row FIELD-WISE for one service (`resolveQoSDefaults`) rather than
// replacing it.
//
// ⚠️⚠️ THE POST IS A WHOLE-ROW REPLACE, NOT A FIELD MERGE — verified against
// the running gateway, and it is the one mistake here that reports success
// while destroying configuration. Posting `{scope:'global',
// default_user_tpm:5000}` over a row holding `default_user_rps:7` left the
// stored row as `{default_user_tpm:5000}` alone: the request limit was GONE,
// and the 204 said nothing about it. ⇒ An editor must send all six limit
// fields every time, seeded from the row it read. `default_user_tpm` merging
// into the existing row is the intuition to distrust.
//
// ⚠️ `rule_ident` PRESENCE IS VALIDATED ON BOTH SIDES, which the read path does
// not prepare you for: GET ignores a stray `rule_ident` on scope `global`
// (proven: it served the global row anyway), but POST REFUSES one —
// 400 `scope 'global' does not take a rule_ident`, `fields:["rule_ident"]`.
// An EMPTY STRING is accepted on `global` (204), so the projection below
// omits the field entirely rather than relying on that.
//
// ⚠️ An unknown scope is refused by the SWAGGER layer, not the handler: HTTP
// 422 with `{"code":606}`, not the 400 class every other rejection here uses.
// The UI constrains the control to the two legal values so that class cannot
// be reached from the form.

export type IRateLimitDefaultsMod = GwSchema<'RateLimitDefaultsMod'>;

export type RateLimitDefaultsScope = IRateLimitDefaultsMod['scope'];

export const RATE_LIMIT_DEFAULTS_SCOPES: readonly RateLimitDefaultsScope[] = ['global', 'rule'] as const;

/**
 * The six limit fields of a defaults row, in the contract's own order.
 *
 * ⭐ Exported because THREE things must agree about this set and would
 * otherwise drift: the all-zero check, the whole-row projection the form
 * sends, and the confirm predicate that reads it back.
 */
export const RATE_LIMIT_DEFAULTS_LIMIT_FIELDS = [
	'default_user_rps',
	'default_user_tpm',
	'default_tenant_rps',
	'default_tenant_tpm',
	'vip_shared_rps',
	'vip_shared_tpm',
] as const;

export type RateLimitDefaultsLimitField = typeof RATE_LIMIT_DEFAULTS_LIMIT_FIELDS[number];

/**
 * Whether this row constrains nothing. The gateway's own rule, not a UI
 * preference: it answers 400 "a defaults entry must set at least one non-zero
 * limit (zero falls through; use DELETE to remove the row)".
 *
 * ⚠️ Note the wording differs from the user endpoint's ("...use DELETE to
 * remove limits"), so the two messages are not interchangeable.
 */
export function rateLimitDefaultsIsAllZero(data: IRateLimitDefaultsMod): boolean {
	return !RATE_LIMIT_DEFAULTS_LIMIT_FIELDS.some(field => (data[field] ?? 0) > 0);
}

/**
 * Project a draft onto the wire shape.
 *
 * ⚠️ `rule_ident` is carried ONLY for scope `rule`. Sending it on `global` is
 * refused outright, and an operator who types a service name and then switches
 * the scope back to global would otherwise post an unsendable body.
 */
export function normalizeRateLimitDefaults(data: IRateLimitDefaultsMod): IRateLimitDefaultsMod {
	const {rule_ident, ...rest} = data;
	const ident = (rule_ident ?? '').trim();
	return {
		...rest,
		...(data.scope === 'rule' && ident.length > 0 ? {rule_ident: ident} : {}),
	};
}

export function validateRateLimitDefaults(data: IRateLimitDefaultsMod): string[] {
	const normalized = normalizeRateLimitDefaults(data);
	const errors: string[] = [];

	if (!RATE_LIMIT_DEFAULTS_SCOPES.includes(normalized.scope)) {
		errors.push('Scope must be either global or rule.');
	}

	const ident = (data.rule_ident ?? '').trim();
	if (normalized.scope === 'rule') {
		// The gateway names the field: 400 with fields:["rule_ident"].
		const identError = qosIdentityError(ident);
		if (identError) errors.push(`Service: ${identError}`);
	} else if (ident.length > 0) {
		// Caught here rather than let through, because the projection drops it
		// and the operator would otherwise see their typed service name vanish
		// from a row that saved "successfully" as a global default.
		errors.push('A global defaults row applies everywhere and cannot name a service. Choose the rule scope to limit it to one.');
	}

	for (const field of RATE_LIMIT_DEFAULTS_LIMIT_FIELDS) {
		const value = normalized[field];
		if (value !== undefined && !isNonNegativeSafeInteger(value)) {
			// The gateway refuses the whole body with "rate limit values must
			// not be negative", so naming the field is the UI's contribution.
			errors.push(`${field} must be a non-negative integer.`);
		}
	}

	// Checked last, so a malformed identity reports as itself.
	if (errors.length === 0 && rateLimitDefaultsIsAllZero(normalized)) {
		errors.push('Set at least one non-zero limit. A zero falls through to the next level of the ladder, so an all-zero row asks for nothing — delete the row instead.');
	}

	return errors;
}
