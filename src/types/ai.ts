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
