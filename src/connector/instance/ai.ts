//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IApiKeyCreateRequest, IApiKeyCreateResponse, IApiKeyPatch, IApiKeySummary, IRateLimitDefaultsEntry, IRateLimitDefaultsMod, ITenantRateLimitEntry, ITenantRateLimitMod, IUserRateLimitEntry, IUserRateLimitMod, RateLimitDefaultsScope, normalizeRateLimitDefaults, normalizeTenantRateLimit, normalizeUserRateLimit, validateApiKeyPatch, validateRateLimitDefaults, validateTenantRateLimit, validateUserRateLimit} from 'types/ai';
import {QuotaStoreState, storeStateFromError} from 'observability/tokenQuota';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, PATCH_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// AI API Keys (/config/ai/apikey)
//---------------------------------------------------------

/**
 * List API keys, optionally filtered by tenant.
 */
export async function query_get_apikey_all(instance: IInstance, tenant_id?: string): Promise<IApiKeySummary[]> {
	const resp = await GET_INST<GwGetResp<'/config/ai/apikey'>>(instance, `/config/ai/apikey`, tenant_id ? {tenant_id} : undefined);
	// A non-2xx (e.g. gateway 501/502 or license-gate 402) must surface so the
	// table shows a retry banner instead of a silent "No rows".
	assertOk(resp, 'Get API Keys');
	// The gateway license-gates AI features with HTTP 402, whose body is a JSON
	// error *object*, not an array. Never pass a non-array through: spreading /
	// mapping it in the list pages would throw and white-screen the app.
	return Array.isArray(resp.data) ? resp.data : [];
}

/**
 * Create a new API key for a tenant ( batch 2 — OpResult).
 * Generated mode returns plaintext only in this response. Imported mode sends
 * caller-supplied material once and the response deliberately omits raw_key.
 * The adapter closes the two false-success gaps the legacy path had: a 200
 * carrying {result:"fail"} and a 200 whose body failed to parse both map to
 * `failed`, so the reveal dialog can never render around a failure body.
 */
export async function request_create_apikey(instance: IInstance, data: IApiKeyCreateRequest): Promise<OpResult<IApiKeyCreateResponse>> {
	try {
		return fromSimpleResponse(await POST_INST<IApiKeyCreateResponse>(instance, `/config/ai/apikey`, data), 'ai.apikey.create');
	} catch (error) {
		return fromNetworkError('ai.apikey.create', error);
	}
}

/**
 * Permanently delete an API key by its ID.
 */
export async function request_delete_apikey(instance: IInstance, key_id: string): Promise<OpResult> {
	try {
		return fromSimpleResponse(await DELETE_INST(instance, `/config/ai/apikey/${encodeURIComponent(key_id)}`), 'ai.apikey.delete');
	} catch (error) {
		return fromNetworkError('ai.apikey.delete', error);
	}
}

/**
 * Update an existing API key's rate limits, model allowlist and/or enabled
 * flag (Stage 4.1).
 *
 * ⭐⭐ WHY THIS ENDPOINT EXISTS: before these fields were patchable, changing a
 * key's limit meant DELETING and recreating the key, which invalidated a
 * credential clients were still holding. That is the whole point of the
 * operation, so it must never silently no-op.
 *
 * ⭐⭐ THE CLIENT-SIDE EMPTY GUARD IS LOAD-BEARING, not defensive politeness.
 * The gateway raises 400 in TWO classes that mean opposite things:
 *
 *   BEFORE the lookup — nothing was asked for (empty object, all-null body, a
 *     body whose only members are unrecognized names), an empty/whitespace
 *     key_id, or a body that fails JSON decoding. Nothing changed, and the key
 *     was NEVER CONSULTED ⇒ this 400 must not be read as "the key exists".
 *   AFTER the lookup — the store rejected a value. Because the model/enabled
 *     update and the rate-limit update are separate statements with NO
 *     TRANSACTION, this 400 can follow a COMMITTED first write.
 *
 * The response cannot tell them apart. But every member of the pre-lookup
 * class is something the CLIENT controls: we refuse an empty patch and an
 * empty key_id here, and the body is built from a typed projection so it can
 * carry neither an unrecognized name nor an undecodable value. ⇒ With those
 * two guards in place, a 400 that still arrives is the post-lookup class, and
 * the honest report is "a value was rejected and the key may be partially
 * updated". `retryable` stays false: retrying the identical body cannot help.
 *
 * ⚠️ REGARDLESS of status, the caller must RE-READ rather than assume the key
 * is unchanged — non-atomic writes mean a failure does not establish rollback,
 * and a 500 carries the same caveat. Returning `invalid` here is a report, not
 * a promise about stored state.
 *
 * ⚠️ Unknown fields are IGNORED by the gateway rather than refused, so a body
 * that misspells one field while naming another is accepted with the
 * misspelling silently dropped. Only `IApiKeyPatch`-typed values are sent, so
 * the UI cannot produce that case — do not relax the projection.
 */
export async function request_patch_apikey(instance: IInstance, key_id: string, patch: IApiKeyPatch): Promise<OpResult> {
	// Pre-lookup class, member 1: an empty or whitespace-only identifier is
	// refused by the gateway before it consults anything.
	if (key_id.trim().length === 0) {
		return {status: 'invalid', code: 'ai.apikey.patch.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: 'An API key identifier is required.'};
	}

	// Pre-lookup class, member 2: a body naming none of the five patchable
	// fields. Kept off the wire so the only 400 that can arrive is the
	// post-lookup one, whose meaning is materially different.
	const errors = validateApiKeyPatch(patch);
	if (errors.length > 0) {
		return {status: 'invalid', code: 'ai.apikey.patch.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: errors.join(' ')};
	}

	try {
		const resp = await PATCH_INST(instance, `/config/ai/apikey/${encodeURIComponent(key_id)}`, patch);
		const result = fromSimpleResponse(resp, 'ai.apikey.patch');
		// ⚠️ Re-label the post-lookup 400 so the operator is told the one thing
		// that matters about it: a preceding field may already be saved. The
		// generic "rejected" wording would invite them to assume nothing
		// changed, which the contract explicitly says not to infer.
		if (resp?.code === 400) {
			return {...result, code: 'ai.apikey.patch.partial_rejected', localeKey: 'The gateway rejected one of these values. Fields are written in separate steps without a transaction, so an earlier field may already be saved — the list has been re-read.'};
		}
		return result;
	} catch (error) {
		return fromNetworkError('ai.apikey.patch', error);
	}
}

//---------------------------------------------------------
// AI Tenant Rate Limits (/config/ai/tenant/ratelimit)
//
// The gateway exposes GET only per-tenant (no list-all) and no DELETE;
// POST is an upsert.
//---------------------------------------------------------

/**
 * Get the rate limit configuration of a single tenant.
 * Returns null when the tenant has no rate limit configured (404).
 */
export async function query_get_tenant_ratelimit(instance: IInstance, tenant_id: string): Promise<ITenantRateLimitEntry | null> {
	const resp = await GET_INST<GwGetResp<'/config/ai/tenant/ratelimit/{tenant_id}'>>(instance, `/config/ai/tenant/ratelimit/${encodeURIComponent(tenant_id)}`);
	// 404 is the normal answer for a tenant with no rate limit configured —
	// this read is fanned out over every tenant, so treating "absent" as a
	// failure would put an error on a healthy page.
	if (resp.code === 404) return null;
	assertOk(resp, 'Get Tenant Rate Limit');
	if (!resp.data) return null;
	return resp.data;
}

/**
 * Fetch rate limits for a set of tenants (the API has no list-all).
 * Tenants without a configured limit are omitted from the result.
 */
export async function query_get_tenant_ratelimits_for(instance: IInstance, tenant_ids: string[]): Promise<ITenantRateLimitEntry[]> {
	const unique = Array.from(new Set(tenant_ids.filter(id => id.length > 0)));
	const entries = await Promise.all(
		unique.map(async id => {
			const resp = await GET_INST<GwGetResp<'/config/ai/tenant/ratelimit/{tenant_id}'>>(instance, `/config/ai/tenant/ratelimit/${encodeURIComponent(id)}`);
			// A tenant with no configured limit answers 404 — that is expected and
			// simply contributes no row. Any OTHER non-2xx (e.g. gateway 501/502)
			// must surface so the table shows a retry banner, not silent "No rows".
			if (resp.code === 404) return null;
			assertOk(resp, 'Get Tenant Rate Limits');
			return resp.data ?? null;
		}),
	);
	return entries.filter((e): e is ITenantRateLimitEntry => e !== null);
}

/**
 * Create or update (upsert) the rate limit configuration for a tenant.
 */
export async function request_set_tenant_ratelimit(instance: IInstance, data: ITenantRateLimitMod): Promise<OpResult> {
	const payload = normalizeTenantRateLimit(data);
	const errors = validateTenantRateLimit(payload);
	if (errors.length > 0) {
		// Client-side backstop (the form validates inline before this point):
		// a mapped `invalid`, with the field messages in diagnostics only.
		return {status: 'invalid', code: 'ai.ratelimit.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: errors.join(' ')};
	}

	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/ai/tenant/ratelimit`, payload), 'ai.ratelimit.set');
	} catch (error) {
		return fromNetworkError('ai.ratelimit.set', error);
	}
}


//---------------------------------------------------------
// AI per-user rate limits (/config/ai/user/ratelimit) — Stage 4.2
//---------------------------------------------------------
// Level 1 of the QoS ladder. ⚠️ There is NO collection GET: the gateway
// serves a list per TENANT and nothing that enumerates tenants, so this
// surface is necessarily driven by a tenant selection. That is the same
// "reachable but not enumerable" shape Stage 3.6 hit on the quota scopes.

/**
 * List a tenant's explicit per-user rate limits.
 *
 * ⚠️ A user with no explicit row DOES NOT APPEAR here — they are governed by
 * the configured defaults. So an empty list means "everyone inherits", never
 * "nobody is limited", and the page must word it that way.
 *
 * ⚠️ The list rows carry NO model limits; only the per-user GET does.
 */
export async function query_get_user_ratelimits(instance: IInstance, tenant_id: string): Promise<IUserRateLimitEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/ai/user/ratelimit/{tenant_id}'>>(
		instance,
		`/config/ai/user/ratelimit/${encodeURIComponent(tenant_id)}`,
	);
	assertOk(resp, 'Get User Rate Limits');
	return Array.isArray(resp.data) ? (resp.data as IUserRateLimitEntry[]) : [];
}

/**
 * Get one user's entry, including the model limits the list omits.
 * Returns null when the user has no explicit entry (404) — the normal answer
 * for a user who simply inherits the defaults.
 */
export async function query_get_user_ratelimit(instance: IInstance, tenant_id: string, user_id: string): Promise<IUserRateLimitEntry | null> {
	const resp = await GET_INST<GwGetResp<'/config/ai/user/ratelimit/{tenant_id}/{user_id}'>>(
		instance,
		`/config/ai/user/ratelimit/${encodeURIComponent(tenant_id)}/${encodeURIComponent(user_id)}`,
	);
	if (resp.code === 404) return null;
	assertOk(resp, 'Get User Rate Limit');
	return (resp.data as IUserRateLimitEntry | undefined) ?? null;
}

/**
 * Create or replace a user's explicit limits (upsert).
 *
 * ⚠️⚠️ THIS IS A REPLACE, NOT A MERGE, and `model_limits` replaces the user's
 * model rows AS A SET — an omitted or empty list CLEARS them. A caller that
 * means to keep the existing model quotas must send them back.
 *
 * ⚠️ An all-zero entry is refused by the gateway (400) because a zero falls
 * through the ladder to the defaults, so such a row constrains nothing.
 * `validateUserRateLimit` refuses it client-side first, with the remedy the
 * gateway names: delete the entry instead. ⭐ A positive per-model quota
 * counts as a limit — verified against the running gateway, not inferred.
 */
export async function request_set_user_ratelimit(instance: IInstance, data: IUserRateLimitMod): Promise<OpResult> {
	const payload = normalizeUserRateLimit(data);
	const errors = validateUserRateLimit(payload);
	if (errors.length > 0) {
		return {status: 'invalid', code: 'ai.user_ratelimit.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: errors.join(' ')};
	}
	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/ai/user/ratelimit`, payload), 'ai.user_ratelimit.set');
	} catch (error) {
		return fromNetworkError('ai.user_ratelimit.set', error);
	}
}

/**
 * Remove a user's explicit entry and model rows. They then fall back to the
 * configured defaults, and to unlimited if no defaults are set — which is why
 * this is the sanctioned way to "remove limits" rather than storing zeros.
 */
export async function request_delete_user_ratelimit(instance: IInstance, tenant_id: string, user_id: string): Promise<OpResult> {
	try {
		return fromSimpleResponse(
			await DELETE_INST(instance, `/config/ai/user/ratelimit/${encodeURIComponent(tenant_id)}/${encodeURIComponent(user_id)}`),
			'ai.user_ratelimit.delete',
		);
	} catch (error) {
		return fromNetworkError('ai.user_ratelimit.delete', error);
	}
}

//---------------------------------------------------------
// AI rate-limit defaults (/config/ai/ratelimit/defaults/{scope})
//---------------------------------------------------------

export interface IQuotaDefaultsRead {
	// ⭐⭐ The reachability of the store BEHIND the configuration, which is the
	// one thing that separates "no quotas configured" from "quotas silently
	// not being enforced". See `observability/tokenQuota.ts`.
	storeState: QuotaStoreState;
	global: IRateLimitDefaultsEntry | null;
	rule: IRateLimitDefaultsEntry | null;
}

/**
 * Read the QoS defaults ladder: the global row, and optionally one rule row.
 *
 * ⚠️⚠️ THIS READ DELIBERATELY DOES NOT `assertOk`, which is the opposite of
 * the house rule for list reads, so it needs its reason stated. Everywhere
 * else a failed read must surface as a banner because "failed" and "empty"
 * would otherwise be indistinguishable to the operator. Here the failure IS
 * the content: a 503 `ai_key_store_unavailable` means the gateway has stopped
 * enforcing every token quota, and throwing it away as a generic error would
 * discard the only signal that distinguishes that from a gateway with nothing
 * configured. The store state is returned as data and classified by
 * `storeStateFromError`; an unrecognised failure becomes `unknown`, which the
 * panel renders as "cannot know" rather than as either answer.
 *
 * ⚠️ 404 is a normal answer — a ladder level that has no row — and is
 * distinct from a store failure: it means the store ANSWERED and holds no
 * defaults for that scope.
 */
export async function query_get_ratelimit_defaults(instance: IInstance, rule_ident?: string): Promise<IQuotaDefaultsRead> {
	const read = async (scope: 'global' | 'rule', ident?: string) => {
		const resp = await GET_INST<GwGetResp<'/config/ai/ratelimit/defaults/{scope}'>>(
			instance,
			`/config/ai/ratelimit/defaults/${scope}`,
			ident ? {rule_ident: ident} : undefined,
		);
		return resp;
	};

	const globalResp = await read('global');
	// ⚠️ The store state is taken from the GLOBAL read alone. The rule read is
	// optional and its absence is routine, so letting it downgrade the state
	// would report an outage on a gateway that simply has no per-rule row.
	if (globalResp.code !== 200 && globalResp.code !== 404) {
		const body = globalResp.data as {result?: string; message?: string} | undefined;
		return {storeState: storeStateFromError(globalResp.code, body?.result ?? body?.message), global: null, rule: null};
	}
	const globalRow = globalResp.code === 404 ? null : (globalResp.data as IRateLimitDefaultsEntry | undefined) ?? null;

	let ruleRow: IRateLimitDefaultsEntry | null = null;
	if (rule_ident) {
		const ruleResp = await read('rule', rule_ident);
		if (ruleResp.code === 200) ruleRow = (ruleResp.data as IRateLimitDefaultsEntry | undefined) ?? null;
	}
	return {storeState: 'readable', global: globalRow, rule: ruleRow};
}

/**
 * Read a set of per-rule defaults rows (Stage 4.2b).
 *
 * ⚠️ THERE IS NO LIST-ALL for rule rows: `GET /config/ai/ratelimit/defaults/rule`
 * without a `rule_ident` answers 404, not a collection. So the rows a page can
 * show are exactly the services it was told to ask about — the same
 * "reachable but not enumerable" shape as `query_get_tenant_ratelimits_for`,
 * whose structure this mirrors deliberately.
 *
 * A service with no row simply contributes nothing (404 is the normal answer
 * for "this service uses the global defaults").
 */
export async function query_get_ratelimit_defaults_for(instance: IInstance, rule_idents: string[]): Promise<IRateLimitDefaultsEntry[]> {
	const unique = Array.from(new Set(rule_idents.map(id => id.trim()).filter(id => id.length > 0)));
	const entries = await Promise.all(
		unique.map(async ident => {
			const resp = await GET_INST<GwGetResp<'/config/ai/ratelimit/defaults/{scope}'>>(
				instance,
				`/config/ai/ratelimit/defaults/rule`,
				{rule_ident: ident},
			);
			if (resp.code === 404) return null;
			assertOk(resp, 'Get Rate Limit Defaults');
			return (resp.data as IRateLimitDefaultsEntry | undefined) ?? null;
		}),
	);
	return entries.filter((e): e is IRateLimitDefaultsEntry => e !== null);
}

/**
 * Create or replace one defaults row (Stage 4.2b).
 *
 * ⚠️⚠️ THIS REPLACES THE WHOLE ROW. The gateway does not merge the body into
 * the stored row: a limit the body omits is CLEARED, and the 204 reports
 * success either way. Verified live — posting only `default_user_tpm` over a
 * row that held `default_user_rps` left the rps limit gone. ⇒ Callers must
 * send the complete six-field row they intend to exist, which is why
 * `RATE_LIMIT_DEFAULTS_LIMIT_FIELDS` is a shared constant rather than a set
 * each caller assembles.
 *
 * ⚠️ An all-zero row is refused (400) because every zero falls through to the
 * next ladder level, so the row would constrain nothing. The remedy the
 * gateway names is DELETE, and `validateRateLimitDefaults` says so client-side
 * before the request is made.
 */
export async function request_set_ratelimit_defaults(instance: IInstance, data: IRateLimitDefaultsMod): Promise<OpResult> {
	// ⚠️⚠️ VALIDATE THE RAW INPUT, NORMALIZE AFTERWARDS — the order is
	// load-bearing and the opposite order is a silent accept. Normalization
	// DROPS a `rule_ident` that the global scope may not carry, so validating
	// the normalized body would destroy the very evidence the check needs: an
	// operator who typed a service name and then switched the scope back to
	// global would be told their row saved, with the service silently gone.
	const errors = validateRateLimitDefaults(data);
	if (errors.length > 0) {
		return {status: 'invalid', code: 'ai.ratelimit_defaults.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: errors.join(' ')};
	}
	const payload = normalizeRateLimitDefaults(data);
	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/ai/ratelimit/defaults`, payload), 'ai.ratelimit_defaults.set');
	} catch (error) {
		return fromNetworkError('ai.ratelimit_defaults.set', error);
	}
}

/**
 * Remove one defaults row. Identities it governed fall through to the next
 * ladder level, and to unlimited if nothing else applies — which is why this,
 * not a row of zeros, is how a default is withdrawn.
 *
 * ⚠️ Deleting a row that does not exist answers 404, so "already gone" is
 * distinguishable from "removed" and is NOT reported as a success here.
 */
export async function request_delete_ratelimit_defaults(instance: IInstance, scope: RateLimitDefaultsScope, rule_ident?: string): Promise<OpResult> {
	const ident = (rule_ident ?? '').trim();
	if (scope === 'rule' && ident.length === 0) {
		// Without an ident the request degenerates into the collection URL,
		// which answers 404 — a confusing "not found" for a row the operator
		// can see on screen.
		return {status: 'invalid', code: 'ai.ratelimit_defaults.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: 'A service identifier is required to delete a rule defaults row.'};
	}
	// ⚠️ `DELETE_INST`'s third argument is a BODY, not a query — the gateway
	// selects the service from the QUERY STRING, so the ident belongs in the
	// URL. Passing it as a body would delete the wrong row: the request would
	// degenerate to the identless URL, which answers 404.
	const url = scope === 'rule'
		? `/config/ai/ratelimit/defaults/rule?rule_ident=${encodeURIComponent(ident)}`
		: `/config/ai/ratelimit/defaults/global`;
	try {
		return fromSimpleResponse(
			await DELETE_INST(instance, url),
			'ai.ratelimit_defaults.delete',
		);
	} catch (error) {
		return fromNetworkError('ai.ratelimit_defaults.delete', error);
	}
}
