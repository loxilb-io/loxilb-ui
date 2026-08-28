import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {POST_INST} from '../fetcher/fetcher_inst';
import {request_create_apikey, request_set_tenant_ratelimit} from './ai';

vi.mock('../fetcher/fetcher_inst', () => ({
	DELETE_INST: vi.fn(),
	GET_INST: vi.fn(),
	POST_INST: vi.fn(),
}));

const instance = {id: 1, name: 'gateway'} as IInstance;

describe('AI write connector wire contracts', () => {
	const post = vi.mocked(POST_INST);

	beforeEach(() => {
		post.mockReset();
	});

	it('sends an imported key exactly once and accepts a response without raw_key', async () => {
		post.mockResolvedValue({code: 201, data: {key_id: 'key-1'}, message: 'Created'});
		const request = {tenant_id: 'tenant-a', api_key: 'imported-key-1234', enabled: true};

		const result = await request_create_apikey(instance, request);
		expect(result).toEqual({status: 'success', created: {key_id: 'key-1'}});
		expect(post).toHaveBeenCalledOnce();
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/apikey', request);
	});

	it('preserves burst and model tombstones in the tenant upsert payload', async () => {
		post.mockResolvedValue({code: 204, data: null, message: ''});
		const result = await request_set_tenant_ratelimit(instance, {
			tenant_id: ' tenant-a ',
			tokens_per_min: 1000,
			burst_pct: 250,
			model_limits: [{model: ' retired-model ', tokens_per_min: 0}],
		});

		expect(result.status).toBe('success');
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/tenant/ratelimit', {
			tenant_id: 'tenant-a',
			tokens_per_min: 1000,
			burst_pct: 250,
			model_limits: [{model: 'retired-model', tokens_per_min: 0}],
		});
	});

	it('normalizes model names and preserves the model quota array', async () => {
		post.mockResolvedValue({code: 200, data: null, message: ''});
		const result = await request_set_tenant_ratelimit(instance, {
			tenant_id: ' tenant-a ',
			rps: 10,
			tokens_per_min: 1000,
			model_limits: [{model: ' llama-70b ', tokens_per_min: 500}],
		});

		expect(result.status).toBe('success');
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/tenant/ratelimit', {
			tenant_id: 'tenant-a',
			rps: 10,
			tokens_per_min: 1000,
			model_limits: [{model: 'llama-70b', tokens_per_min: 500}],
		});
	});

	it('preserves multiple zero-valued model tombstones in the POST payload', async () => {
		post.mockResolvedValue({code: 200, data: null, message: ''});
		const model_limits = [
			{model: 'llama-70b', tokens_per_min: 0},
			{model: 'mixtral', tokens_per_min: 0},
		];
		const result = await request_set_tenant_ratelimit(instance, {tenant_id: 'tenant-a', model_limits});

		expect(result.status).toBe('success');
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/tenant/ratelimit', {tenant_id: 'tenant-a', model_limits});
	});

	it('blocks duplicate model names before POST', async () => {
		const result = await request_set_tenant_ratelimit(instance, {
			tenant_id: 'tenant-a',
			model_limits: [
				{model: 'llama-70b', tokens_per_min: 500},
				{model: ' llama-70b ', tokens_per_min: 250},
			],
		});

		expect(result.status).toBe('error');
		expect(result.error).toContain('duplicated');
		expect(post).not.toHaveBeenCalled();
	});

	it('rejects invalid burst locally without sending a request', async () => {
		const result = await request_set_tenant_ratelimit(instance, {tenant_id: 'tenant-a', burst_pct: 1001});
		expect(result.status).toBe('error');
		expect(post).not.toHaveBeenCalled();
	});
});
