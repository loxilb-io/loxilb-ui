import {describe, expect, it} from 'vitest';
import {normalizeTenantRateLimit, reconcileTenantModelLimits, validateTenantRateLimit} from './ai';

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
