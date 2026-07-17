//---------------------------------------------------------
// AI Gateway Types (API keys + tenant rate limits)
//
// Derived from the vendored gateway swagger (src/api/gen/gateway.ts)
// so they cannot drift from the live API contract.
//---------------------------------------------------------
import type {GwSchema} from 'api';

// POST /config/ai/apikey request body
export type IApiKeyCreateRequest = GwSchema<'ApiKeyCreateRequest'>;

// POST /config/ai/apikey 201 body — raw_key is returned ONLY here
export type IApiKeyCreateResponse = GwSchema<'ApiKeyCreateResponse'>;

// GET /config/ai/apikey list element
export type IApiKeySummary = GwSchema<'ApiKeySummary'>;

// POST /config/ai/tenant/ratelimit body (upsert)
export type ITenantRateLimitMod = GwSchema<'TenantRateLimitMod'>;

// GET /config/ai/tenant/ratelimit/{tenant_id} body
export type ITenantRateLimitEntry = GwSchema<'TenantRateLimitEntry'>;
