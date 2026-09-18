import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {DELETE_INST, GET_INST, PATCH_INST, POST_INST} from '../fetcher/fetcher_inst';
import {query_get_ratelimit_defaults, query_get_user_ratelimit, query_get_user_ratelimits, request_create_apikey, request_delete_user_ratelimit, request_patch_apikey, request_set_tenant_ratelimit, request_set_user_ratelimit} from './ai';

vi.mock('../fetcher/fetcher_inst', () => ({
	DELETE_INST: vi.fn(),
	GET_INST: vi.fn(),
	PATCH_INST: vi.fn(),
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

//---------------------------------------------------------
// PATCH /config/ai/apikey/{key_id} — Stage 4.1
//---------------------------------------------------------
// The contract's presence semantics are the opposite of the create path's, and
// the two 400 classes mean opposite things. Both are pinned here.

describe('API key patch wire contract', () => {
	const patch = vi.mocked(PATCH_INST);

	beforeEach(() => {
		patch.mockReset();
	});

	//---------------------------------------------------------
	// ⭐⭐ The inversion: 0 is a VALUE here, not a sentinel for "unset"
	//---------------------------------------------------------

	it('sends an explicit 0 rather than omitting it — on PATCH, 0 means "no limit" and omission means "unchanged"', async () => {
		patch.mockResolvedValue({code: 204, data: null, message: ''});

		const result = await request_patch_apikey(instance, 'key-1', {rate_limit_rps: 0});

		expect(result.status).toBe('confirmed');
		// The create projection drops a 0 (`rps > 0 &&`). Doing that here would
		// turn "make this key unlimited" into "change nothing" and still report
		// success — the one failure mode that looks exactly like a win.
		expect(patch).toHaveBeenCalledWith(instance, '/config/ai/apikey/key-1', {rate_limit_rps: 0});
	});

	it('sends every one of the five patchable fields, zeros included', async () => {
		patch.mockResolvedValue({code: 204, data: null, message: ''});

		await request_patch_apikey(instance, 'key-1', {
			allowed_models: ['org/a'],
			enabled: false,
			rate_limit_rps: 0,
			burst_size: 0,
			tokens_per_min: 0,
		});

		expect(patch).toHaveBeenCalledWith(instance, '/config/ai/apikey/key-1', {
			allowed_models: ['org/a'],
			enabled: false,
			rate_limit_rps: 0,
			burst_size: 0,
			tokens_per_min: 0,
		});
	});

	it('sends enabled:false, which must not be dropped as falsy', async () => {
		patch.mockResolvedValue({code: 204, data: null, message: ''});
		await request_patch_apikey(instance, 'key-1', {enabled: false});
		expect(patch).toHaveBeenCalledWith(instance, '/config/ai/apikey/key-1', {enabled: false});
	});

	it('sends an explicit empty allowed_models, which CLEARS the restriction and is not "nothing asked"', async () => {
		patch.mockResolvedValue({code: 204, data: null, message: ''});

		const result = await request_patch_apikey(instance, 'key-1', {allowed_models: []});

		expect(result.status).toBe('confirmed');
		expect(patch).toHaveBeenCalledWith(instance, '/config/ai/apikey/key-1', {allowed_models: []});
	});

	//---------------------------------------------------------
	// The pre-lookup 400 class, kept off the wire
	//---------------------------------------------------------

	it('refuses a body naming no patchable field WITHOUT sending it', async () => {
		const result = await request_patch_apikey(instance, 'key-1', {});

		expect(result.status).toBe('invalid');
		expect(result.code).toBe('ai.apikey.patch.client_invalid');
		// The gateway would answer 400 before looking the key up, which is
		// indistinguishable on the wire from the post-lookup 400 that CAN follow
		// a committed write. Not sending it is what keeps the two apart.
		expect(patch).not.toHaveBeenCalled();
	});

	it('treats an all-null body as naming nothing, exactly as the gateway does', async () => {
		const result = await request_patch_apikey(instance, 'key-1', {
			rate_limit_rps: undefined,
			burst_size: undefined,
			tokens_per_min: undefined,
			enabled: undefined,
			allowed_models: undefined,
		});

		expect(result.status).toBe('invalid');
		expect(patch).not.toHaveBeenCalled();
	});

	it('refuses a whitespace-only key id without sending it', async () => {
		const result = await request_patch_apikey(instance, '   ', {rate_limit_rps: 5});

		expect(result.status).toBe('invalid');
		expect(result.code).toBe('ai.apikey.patch.client_invalid');
		expect(patch).not.toHaveBeenCalled();
	});

	it('refuses a negative rate before sending it', async () => {
		const result = await request_patch_apikey(instance, 'key-1', {rate_limit_rps: -1});
		expect(result.status).toBe('invalid');
		expect(patch).not.toHaveBeenCalled();
	});

	it('refuses a model name containing a comma, which the store would split into two names', async () => {
		const result = await request_patch_apikey(instance, 'key-1', {allowed_models: ['org/a,org/b']});
		expect(result.status).toBe('invalid');
		expect(patch).not.toHaveBeenCalled();
	});

	it('refuses an empty model name, which the store would read as "allow all"', async () => {
		const result = await request_patch_apikey(instance, 'key-1', {allowed_models: ['']});
		expect(result.status).toBe('invalid');
		expect(patch).not.toHaveBeenCalled();
	});

	//---------------------------------------------------------
	// The post-lookup 400, and why it is not 404
	//---------------------------------------------------------

	it('reports a 400 as a POSSIBLY PARTIAL update rather than a plain rejection', async () => {
		patch.mockResolvedValue({code: 400, data: {error: 'invalid value'}, message: 'Bad Request'});

		const result = await request_patch_apikey(instance, 'key-1', {tokens_per_min: 1000});

		expect(result.status).toBe('invalid');
		// ⚠️ The distinct code is the point: the model/enabled write and the
		// rate-limit write are separate statements with no transaction, so a
		// rejection here can follow a COMMITTED first write. "Rejected" alone
		// would invite the operator to assume nothing changed.
		expect(result.code).toBe('ai.apikey.patch.partial_rejected');
		expect(result.localeKey).toMatch(/an earlier field may already be saved/i);
	});

	it('keeps 404 distinct from 400 — a 400 never means the key exists', async () => {
		patch.mockResolvedValue({code: 404, data: {error: 'not found'}, message: 'Not Found'});

		const result = await request_patch_apikey(instance, 'missing-key', {rate_limit_rps: 5});

		expect(result.code).not.toBe('ai.apikey.patch.partial_rejected');
		expect(result.httpStatus).toBe(404);
	});

	it('reports an unconfigured key store as its own condition, not as a bad request', async () => {
		patch.mockResolvedValue({code: 503, data: {error: 'ai_key_store_unconfigured'}, message: 'Service Unavailable'});

		const result = await request_patch_apikey(instance, 'key-1', {rate_limit_rps: 5});

		expect(result.httpStatus).toBe(503);
		expect(result.code).not.toBe('ai.apikey.patch.partial_rejected');
	});

	it('percent-encodes the key id into the path', async () => {
		patch.mockResolvedValue({code: 204, data: null, message: ''});
		await request_patch_apikey(instance, 'key/../evil id', {rate_limit_rps: 1});
		expect(patch).toHaveBeenCalledWith(instance, '/config/ai/apikey/key%2F..%2Fevil%20id', {rate_limit_rps: 1});
	});

	it('degrades a thrown transport error instead of escaping', async () => {
		patch.mockRejectedValue(new Error('boom'));
		const result = await request_patch_apikey(instance, 'key-1', {rate_limit_rps: 1});
		expect(result.status).not.toBe('confirmed');
	});
});

//---------------------------------------------------------
// Per-user rate limits — Stage 4.2
//---------------------------------------------------------

describe('user rate-limit wire contract', () => {
	const post = vi.mocked(POST_INST);
	const get = vi.mocked(GET_INST);
	const del = vi.mocked(DELETE_INST);

	beforeEach(() => {
		post.mockReset();
		get.mockReset();
		del.mockReset();
	});

	it('refuses an all-zero entry WITHOUT sending it, naming delete as the remedy', async () => {
		const result = await request_set_user_ratelimit(instance, {tenant_id: 't', user_id: 'u', rps: 0, burst_size: 0, tokens_per_min: 0});

		expect(result.status).toBe('invalid');
		expect(result.code).toBe('ai.user_ratelimit.client_invalid');
		// A zero here means "fall through to the defaults", so an all-zero row
		// constrains nothing. The gateway refuses it 400; not sending it lets
		// the UI explain the remedy instead of surfacing a raw rejection.
		expect(result.rawDetail).toMatch(/delete the entry/i);
		expect(post).not.toHaveBeenCalled();
	});

	it('ACCEPTS zero scalars when a per-model quota carries the limit', async () => {
		// ⭐ Settled against the running gateway rather than the prose, which
		// does not say whether model_limits are "limit fields": rps/burst/tpm
		// all 0 plus one model row at 100 tokens/min answers 204.
		post.mockResolvedValue({code: 204, data: null, message: ''});

		const result = await request_set_user_ratelimit(instance, {
			tenant_id: 't', user_id: 'u', rps: 0, burst_size: 0, tokens_per_min: 0,
			model_limits: [{model: 'org/m', tokens_per_min: 100}],
		});

		expect(result.status).toBe('confirmed');
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/user/ratelimit', {
			tenant_id: 't', user_id: 'u', rps: 0, burst_size: 0, tokens_per_min: 0,
			model_limits: [{model: 'org/m', tokens_per_min: 100}],
		});
	});

	it('refuses an identity containing the bucket-key delimiter before sending it', async () => {
		const result = await request_set_user_ratelimit(instance, {tenant_id: 't', user_id: 'u|3', tokens_per_min: 100});
		expect(result.status).toBe('invalid');
		expect(post).not.toHaveBeenCalled();
	});

	it('refuses an identity beginning with a reserved scope prefix before sending it', async () => {
		// `u:` would let this user's bucket round-trip into another scope.
		for (const user_id of ['u:4', 'uq:x', 'ver:1', 'kq:a']) {
			const result = await request_set_user_ratelimit(instance, {tenant_id: 't', user_id, tokens_per_min: 100});
			expect(result.status, user_id).toBe('invalid');
		}
		expect(post).not.toHaveBeenCalled();
	});

	it('trims identities and drops nameless model rows before sending', async () => {
		post.mockResolvedValue({code: 204, data: null, message: ''});

		await request_set_user_ratelimit(instance, {
			tenant_id: ' t ', user_id: ' u ', tokens_per_min: 100,
			model_limits: [{model: '  ', tokens_per_min: 5}, {model: ' org/m ', tokens_per_min: 7}],
		});

		expect(post).toHaveBeenCalledWith(instance, '/config/ai/user/ratelimit', {
			tenant_id: 't', user_id: 'u', tokens_per_min: 100,
			model_limits: [{model: 'org/m', tokens_per_min: 7}],
		});
	});

	it('preserves an EMPTY model list, which is how model rows are cleared', async () => {
		post.mockResolvedValue({code: 204, data: null, message: ''});

		await request_set_user_ratelimit(instance, {tenant_id: 't', user_id: 'u', tokens_per_min: 100, model_limits: []});

		// ⚠️ `model_limits` replaces the set, so an empty list is a request to
		// clear the user's model rows — dropping the key would silently keep
		// quotas the operator just removed.
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/user/ratelimit', {
			tenant_id: 't', user_id: 'u', tokens_per_min: 100, model_limits: [],
		});
	});

	it('reads a user with no explicit entry as null rather than as a failure', async () => {
		get.mockResolvedValue({code: 404, data: undefined, message: 'Not Found'} as never);
		// Inheriting the defaults is the normal case, not an error.
		await expect(query_get_user_ratelimit(instance, 't', 'u')).resolves.toBeNull();
	});

	it('percent-encodes both path segments', async () => {
		get.mockResolvedValue({code: 200, data: {tenant_id: 't/x', user_id: 'u x'}, message: ''} as never);
		await query_get_user_ratelimit(instance, 't/x', 'u x');
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/user/ratelimit/t%2Fx/u%20x');
	});

	it('never passes a non-array list through', async () => {
		get.mockResolvedValue({code: 200, data: {error: 'not a list'}, message: ''} as never);
		await expect(query_get_user_ratelimits(instance, 't')).resolves.toEqual([]);
	});

	it('deletes by tenant and user, encoded', async () => {
		del.mockResolvedValue({code: 204, data: null, message: ''});
		const result = await request_delete_user_ratelimit(instance, 't/x', 'u x');
		expect(result.status).toBe('confirmed');
		expect(del).toHaveBeenCalledWith(instance, '/config/ai/user/ratelimit/t%2Fx/u%20x');
	});
});
