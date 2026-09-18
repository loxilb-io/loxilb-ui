//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IApiKeyCreateRequest, IApiKeyCreateResponse, IApiKeySummary, IRateLimitDefaultsEntry, ITenantRateLimitEntry, ITenantRateLimitMod, normalizeTenantRateLimit, validateTenantRateLimit} from 'types/ai';
import {QuotaStoreState, storeStateFromError} from 'observability/tokenQuota';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
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
