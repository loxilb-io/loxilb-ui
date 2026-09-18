import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {query_get_ratelimit_defaults, request_create_apikey, request_set_tenant_ratelimit} from './ai';

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
		expect(result.status).toBe('confirmed');
		expect(result.data).toEqual({key_id: 'key-1'});
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

		expect(result.status).toBe('confirmed');
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

		expect(result.status).toBe('confirmed');
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

		expect(result.status).toBe('confirmed');
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

		expect(result.status).toBe('invalid');
		// Field detail is diagnostics-only under OpResult (never rendered raw).
		expect(result.rawDetail).toContain('duplicated');
		expect(post).not.toHaveBeenCalled();
	});

	it('rejects invalid burst locally without sending a request', async () => {
		const result = await request_set_tenant_ratelimit(instance, {tenant_id: 'tenant-a', burst_pct: 1001});
		expect(result.status).toBe('invalid');
		expect(post).not.toHaveBeenCalled();
	});
});

//---------------------------------------------------------
// The QoS defaults read (Stage 3.6)
//---------------------------------------------------------
// ⚠️⚠️ This read is the ONE list-shaped read in this file that must NOT throw
// on a server failure, and these tests exist to keep it that way. A 503
// `ai_key_store_unavailable` is the signal that token quotas have silently
// stopped being enforced; `assertOk` would convert it into a generic banner
// and the panel could no longer tell it from a gateway with nothing
// configured. See `observability/tokenQuota.ts`.

describe('query_get_ratelimit_defaults', () => {
	const get = vi.mocked(GET_INST);

	beforeEach(() => {
		get.mockReset();
	});

	it('carries an unconfigured store back as data instead of throwing', async () => {
		get.mockResolvedValue({code: 503, data: {result: 'ai_key_store_unconfigured'}, message: 'Service Unavailable'} as never);
		await expect(query_get_ratelimit_defaults(instance)).resolves.toEqual({
			storeState: 'unconfigured', global: null, rule: null,
		});
	});

	// ⚠️⚠️ The dangerous one: quotas are configured and not being enforced.
	it('carries an unavailable store back distinctly from an unconfigured one', async () => {
		get.mockResolvedValue({code: 503, data: {result: 'ai_key_store_unavailable'}, message: 'Service Unavailable'} as never);
		const read = await query_get_ratelimit_defaults(instance);
		expect(read.storeState).toBe('unavailable');
	});

	it('reads an unrecognised failure as unknown rather than as either answer', async () => {
		get.mockResolvedValue({code: 500, data: {result: 'internal error'}, message: 'Internal Server Error'} as never);
		expect((await query_get_ratelimit_defaults(instance)).storeState).toBe('unknown');
	});

	// ⚠️ 404 means the store ANSWERED and holds no row — readable, not failed.
	it('treats a missing global row as readable with no defaults', async () => {
		get.mockResolvedValue({code: 404, data: undefined, message: 'Not Found'} as never);
		await expect(query_get_ratelimit_defaults(instance)).resolves.toEqual({
			storeState: 'readable', global: null, rule: null,
		});
	});

	it('returns the global row and does not read a rule row unless asked', async () => {
		get.mockResolvedValue({code: 200, data: {scope: 'global', default_tenant_tpm: 100}, message: 'OK'} as never);
		const read = await query_get_ratelimit_defaults(instance);
		expect(read.global).toEqual({scope: 'global', default_tenant_tpm: 100});
		expect(get).toHaveBeenCalledOnce();
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/ratelimit/defaults/global', undefined);
	});

	it('passes rule_ident as a query parameter for the rule row', async () => {
		get.mockImplementation((async (_i: unknown, path: string) => (
			path.endsWith('/global')
				? {code: 200, data: {scope: 'global', default_tenant_tpm: 100}, message: 'OK'}
				: {code: 200, data: {scope: 'rule', rule_ident: 'svc-1', vip_shared_tpm: 50}, message: 'OK'}
		)) as never);
		const read = await query_get_ratelimit_defaults(instance, 'svc-1');
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/ratelimit/defaults/rule', {rule_ident: 'svc-1'});
		expect(read.rule).toEqual({scope: 'rule', rule_ident: 'svc-1', vip_shared_tpm: 50});
	});

	// ⚠️ A rule row is optional and its absence is routine, so it must never
	// downgrade the store state the global read established.
	it('keeps the store readable when only the rule row is missing', async () => {
		get.mockImplementation((async (_i: unknown, path: string) => (
			path.endsWith('/global')
				? {code: 200, data: {scope: 'global', default_tenant_tpm: 100}, message: 'OK'}
				: {code: 404, data: undefined, message: 'Not Found'}
		)) as never);
		const read = await query_get_ratelimit_defaults(instance, 'svc-1');
		expect(read.storeState).toBe('readable');
		expect(read.rule).toBeNull();
	});
});
