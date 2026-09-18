import {describe, expect, it} from 'vitest';
import {API_KEY_PATCH_FIELDS, apiKeyPatchIsEmpty, normalizeTenantRateLimit, reconcileTenantModelLimits, validateApiKeyPatch, validateTenantRateLimit} from './ai';

describe('tenant per-model quota contract', () => {
	describe('edit reconciliation', () => {
		const persisted = [
			{model: 'llama-70b', tokens_per_min: 500},
			{model: 'mixtral', tokens_per_min: 250},
		];

		it('emits a tombstone when one persisted model is removed', () => {
			expect(reconcileTenantModelLimits(
				[{model: 'llama-70b', tokens_per_min: 600}],
				persisted,
			)).toEqual([
				{model: 'llama-70b', tokens_per_min: 600},
				{model: 'mixtral', tokens_per_min: 0},
			]);
		});

		it('emits tombstones for every persisted model when all rows are removed', () => {
			expect(reconcileTenantModelLimits([], persisted)).toEqual([
				{model: 'llama-70b', tokens_per_min: 0},
				{model: 'mixtral', tokens_per_min: 0},
			]);
		});

		it('treats a rename as a new row plus an old-name tombstone', () => {
			expect(reconcileTenantModelLimits(
				[
					{model: 'llama-3.1-70b', tokens_per_min: 700},
					{model: 'mixtral', tokens_per_min: 250},
				],
				persisted,
			)).toEqual([
				{model: 'llama-3.1-70b', tokens_per_min: 700},
				{model: 'mixtral', tokens_per_min: 250},
				{model: 'llama-70b', tokens_per_min: 0},
			]);
		});

		it('does not add tombstones to an unchanged edit', () => {
			expect(reconcileTenantModelLimits(persisted, persisted)).toEqual(persisted);
		});

		it('does not invent tombstones while creating a tenant', () => {
			const created = [{model: 'llama-70b', tokens_per_min: 500}];
			expect(reconcileTenantModelLimits(created)).toEqual(created);
			expect(reconcileTenantModelLimits()).toEqual([]);
		});
	});

	it('normalizes tenant and model names while preserving model order', () => {
		expect(normalizeTenantRateLimit({
			tenant_id: ' tenant-a ',
			rps: 10,
			tokens_per_min: 1000,
			model_limits: [
				{model: ' llama-70b ', tokens_per_min: 500},
				{model: 'mixtral', tokens_per_min: 0},
			],
		})).toEqual({
			tenant_id: 'tenant-a',
			rps: 10,
			tokens_per_min: 1000,
			model_limits: [
				{model: 'llama-70b', tokens_per_min: 500},
				{model: 'mixtral', tokens_per_min: 0},
			],
		});
	});

	it('accepts zero as the explicit remove/unlimited API value', () => {
		expect(validateTenantRateLimit({
			tenant_id: 'tenant-a',
			rps: 0,
			tokens_per_min: 0,
			burst_pct: 0,
			model_limits: [{model: 'llama-70b', tokens_per_min: 0}],
		})).toEqual([]);
	});

	it('round-trips burst percentage without disturbing model tombstones', () => {
		expect(normalizeTenantRateLimit({
			tenant_id: ' tenant-a ',
			burst_pct: 250,
			model_limits: [{model: ' removed-model ', tokens_per_min: 0}],
		})).toEqual({
			tenant_id: 'tenant-a',
			burst_pct: 250,
			model_limits: [{model: 'removed-model', tokens_per_min: 0}],
		});
	});

	it('accepts burst boundaries and rejects negative, fractional, overflow and unsafe values', () => {
		for (const burst_pct of [0, 1, 100, 1000]) {
			expect(validateTenantRateLimit({tenant_id: 'tenant-a', burst_pct})).toEqual([]);
		}
		for (const burst_pct of [-1, 1.5, 1001, Number.MAX_SAFE_INTEGER + 1]) {
			expect(validateTenantRateLimit({tenant_id: 'tenant-a', burst_pct})).toContain(
				'Tenant burst percentage must be 0 or an integer between 1 and 1000.',
			);
		}
	});

	it('omits an empty model array for backward-compatible tenant-only updates', () => {
		expect(normalizeTenantRateLimit({tenant_id: 'tenant-a', rps: 10, model_limits: []})).toEqual({
			tenant_id: 'tenant-a',
			rps: 10,
		});
	});

	it('rejects blank and duplicate model rows', () => {
		const errors = validateTenantRateLimit({
			tenant_id: 'tenant-a',
			model_limits: [
				{model: 'llama-70b', tokens_per_min: 100},
				{model: ' llama-70b ', tokens_per_min: 200},
				{model: ' ', tokens_per_min: 300},
			],
		});
		expect(errors).toEqual(expect.arrayContaining([
			'Model quota llama-70b is duplicated.',
			'Model quota row 3 requires a model name.',
		]));
	});

	it('rejects negative, fractional, unsafe, and missing numeric limits', () => {
		const errors = validateTenantRateLimit({
			tenant_id: 'tenant-a',
			rps: -1,
			tokens_per_min: 1.5,
			model_limits: [
				{model: 'missing'},
				{model: 'unsafe', tokens_per_min: Number.MAX_SAFE_INTEGER + 1},
			],
		});
		expect(errors).toHaveLength(4);
	});
});

//---------------------------------------------------------
// API key PATCH contract (Stage 4.1)
//---------------------------------------------------------

describe('API key patch contract', () => {
	it('carries FIVE patchable fields, not the three rate-limit ones the brief names', () => {
		// `allowed_models` and `enabled` patch on the same call and share the
		// same presence rules. Dropping either from this list would make
		// `apiKeyPatchIsEmpty` answer "nothing asked" for a real change and the
		// connector would refuse a legitimate patch client-side.
		//
		// ⭐ The set AND this order are the gateway's own, proven at runtime
		// rather than read off prose: an empty-body PATCH answers 400 with
		// "no patchable field supplied: name at least one of allowed_models,
		// enabled, rate_limit_rps, burst_size, tokens_per_min".
		//
		// ⭐ That 400 also arrives on a gateway whose key store is UNCONFIGURED
		// (which would otherwise answer 503), which is the live proof that the
		// nonempty-patch check runs BEFORE the store and key are consulted —
		// i.e. that such a 400 really does not mean the key exists.
		expect(API_KEY_PATCH_FIELDS).toHaveLength(5);
		expect([...API_KEY_PATCH_FIELDS]).toEqual(['allowed_models', 'enabled', 'rate_limit_rps', 'burst_size', 'tokens_per_min']);
	});

	describe('the "nothing asked" class', () => {
		it('counts an empty object and an all-undefined body', () => {
			expect(apiKeyPatchIsEmpty({})).toBe(true);
			expect(apiKeyPatchIsEmpty({rate_limit_rps: undefined, enabled: undefined})).toBe(true);
			expect(apiKeyPatchIsEmpty(null)).toBe(true);
			expect(apiKeyPatchIsEmpty(undefined)).toBe(true);
		});

		it('does NOT count a zero — 0 is an explicit limit, the whole point of the field', () => {
			expect(apiKeyPatchIsEmpty({rate_limit_rps: 0})).toBe(false);
			expect(apiKeyPatchIsEmpty({burst_size: 0})).toBe(false);
			expect(apiKeyPatchIsEmpty({tokens_per_min: 0})).toBe(false);
		});

		it('does NOT count enabled:false', () => {
			expect(apiKeyPatchIsEmpty({enabled: false})).toBe(false);
		});

		it('does NOT count an empty allowed_models — a present field that clears the restriction', () => {
			expect(apiKeyPatchIsEmpty({allowed_models: []})).toBe(false);
		});
	});

	describe('validation', () => {
		it('accepts a patch of zeros', () => {
			expect(validateApiKeyPatch({rate_limit_rps: 0, burst_size: 0, tokens_per_min: 0})).toEqual([]);
		});

		it('rejects a patch that asks for nothing, and says so once', () => {
			expect(validateApiKeyPatch({})).toEqual(['Change at least one field before applying.']);
		});

		it('rejects negative and fractional rates', () => {
			expect(validateApiKeyPatch({rate_limit_rps: -1})).not.toEqual([]);
			expect(validateApiKeyPatch({tokens_per_min: 1.5})).not.toEqual([]);
		});

		it('rejects model names the store would silently mangle', () => {
			// The gateway joins/splits the list on commas without lossless
			// encoding, so a comma inside a name becomes two names...
			expect(validateApiKeyPatch({allowed_models: ['a,b']})).not.toEqual([]);
			// ...and an empty item makes the list unrestricted.
			expect(validateApiKeyPatch({allowed_models: ['']})).not.toEqual([]);
			expect(validateApiKeyPatch({allowed_models: ['   ']})).not.toEqual([]);
		});

		it('rejects a duplicated model', () => {
			expect(validateApiKeyPatch({allowed_models: ['org/a', 'org/a']})).not.toEqual([]);
		});

		it('accepts an empty list, which is how the restriction is cleared', () => {
			expect(validateApiKeyPatch({allowed_models: []})).toEqual([]);
		});
	});
});
