//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IApiKeyCreateRequest, IApiKeyCreateResponse, IApiKeySummary, ITenantRateLimitEntry, ITenantRateLimitMod} from 'types/ai';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// AI API Keys (/config/ai/apikey)
//---------------------------------------------------------

/**
 * List API keys, optionally filtered by tenant.
 */
export async function query_get_apikey_all(instance: IInstance, tenant_id?: string): Promise<IApiKeySummary[]> {
	const resp = await GET_INST<GwGetResp<'/config/ai/apikey'>>(instance, `/config/ai/apikey`, tenant_id ? {tenant_id} : undefined);
	// The gateway license-gates AI features with HTTP 402, whose body is a JSON
	// error *object*, not an array. Never pass a non-array through: spreading /
	// mapping it in the list pages would throw and white-screen the app.
	return Array.isArray(resp.data) ? resp.data : [];
}

export type ApiKeyCreateResult = ApiResult & {created?: IApiKeyCreateResponse};

/**
 * Create a new API key for a tenant.
 * The plaintext key is returned ONLY in this response — the caller must
 * surface it to the user immediately; it can never be retrieved again.
 */
export async function request_create_apikey(instance: IInstance, data: IApiKeyCreateRequest): Promise<ApiKeyCreateResult> {
	const resp = await POST_INST<IApiKeyCreateResponse>(instance, `/config/ai/apikey`, data);
	if (resp.code !== 200 && resp.code !== 201) {
		const errorMessage = createDetailedErrorMessage(resp, 'AI API Key Create');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success', created: resp.data ?? undefined};
}

/**
 * Permanently delete an API key by its ID.
 */
export async function request_delete_apikey(instance: IInstance, key_id: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ai/apikey/${encodeURIComponent(key_id)}`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'AI API Key Delete');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
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
	if (resp.code !== 200 || !resp.data) return null;
	return resp.data;
}

/**
 * Fetch rate limits for a set of tenants (the API has no list-all).
 * Tenants without a configured limit are omitted from the result.
 */
export async function query_get_tenant_ratelimits_for(instance: IInstance, tenant_ids: string[]): Promise<ITenantRateLimitEntry[]> {
	const unique = Array.from(new Set(tenant_ids.filter(id => id.length > 0)));
	const entries = await Promise.all(unique.map(id => query_get_tenant_ratelimit(instance, id)));
	return entries.filter((e): e is ITenantRateLimitEntry => e !== null);
}

/**
 * Create or update (upsert) the rate limit configuration for a tenant.
 */
export async function request_set_tenant_ratelimit(instance: IInstance, data: ITenantRateLimitMod): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ai/tenant/ratelimit`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'AI Tenant Rate Limit');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}
