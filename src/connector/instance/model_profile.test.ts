import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {ApiError} from '../fetcher/fetcher_base';
import {GET_INST} from '../fetcher/fetcher_inst';
import * as modelProfileModule from './model_profile';
import {query_get_kvexact_status, query_get_model_profile, query_get_model_profiles} from './model_profile';

vi.mock('../fetcher/fetcher_inst', () => ({
	GET_INST: vi.fn(),
}));

const instance = {id: 1, name: 'gateway'} as IInstance;
const get = vi.mocked(GET_INST);

beforeEach(() => {
	get.mockReset();
});

describe('model-profile read connector', () => {
	it('is read-only by construction: the module exports no mutation surface (AC-12)', () => {
		// The fetcher mock above only provides GET_INST — importing this module
		// would already throw if it referenced POST/PUT/PATCH/DELETE. Belt and
		// braces: no exported function may look like a mutation either.
		for (const name of Object.keys(modelProfileModule)) {
			expect(name).not.toMatch(/^(request_|create|update|delete|upload|publish|reload)/i);
		}
	});

	it('passes a populated registry through untouched', async () => {
		const registry = {
			registryGeneration: 4,
			setDigest: 'digest-4',
			profiles: [{profileId: 'qwen3-chat', gen: 4, baseModel: 'Qwen/Qwen3-32B', aliasPolicy: 'list', supportedApis: ['chat'], tokenizerSha256: 'a'.repeat(64)}],
		};
		get.mockResolvedValue({code: 200, data: registry, message: 'OK'});

		expect(await query_get_model_profiles(instance)).toEqual(registry);
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/model-profiles');
	});

	it('treats generation 0 with an empty set as a normal payload, not an error (GW-02)', async () => {
		const empty = {registryGeneration: 0, profiles: []};
		get.mockResolvedValue({code: 200, data: empty, message: 'OK'});
		expect(await query_get_model_profiles(instance)).toEqual(empty);
	});

	it('normalizes a malformed body to the documented empty state instead of white-screening', async () => {
		get.mockResolvedValue({code: 200, data: {error: 'not a registry'}, message: 'OK'});
		expect(await query_get_model_profiles(instance)).toEqual({registryGeneration: 0, profiles: []});
	});

	it('surfaces list errors with their status for the FR-05 vocabulary', async () => {
		get.mockResolvedValue({code: 503, data: {message: 'store unavailable'}, message: 'Service Unavailable'});
		await expect(query_get_model_profiles(instance)).rejects.toMatchObject({status: 503});
	});

	it('URL-encodes the profile id on the detail read', async () => {
		get.mockResolvedValue({code: 200, data: {profileId: 'a/b', gen: 1, baseModel: 'm', aliasPolicy: 'base_model_only', supportedApis: ['chat'], tokenizerSha256: 'c'.repeat(64)}, message: 'OK'});
		await query_get_model_profile(instance, 'a/b');
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/model-profiles/a%2Fb');
	});

	it('surfaces a stale detail selection as a 404 ApiError', async () => {
		get.mockResolvedValue({code: 404, data: {message: 'not published'}, message: 'Not Found'});
		await expect(query_get_model_profile(instance, 'gone')).rejects.toMatchObject({status: 404});
	});
});

describe('kvexactstatus read connector', () => {
	const key = {externalIP: '192.0.2.10', port: 8000, protocol: 'tcp'};

	it('reads the composite key path and unwraps the entry array', async () => {
		const entry = {ruleIdentity: 'r1', modelName: 'm', engineFamily: 'vllm', apiMode: 'chat', desiredState: 'READY', enforcedState: 'READY', reasonCodes: []};
		get.mockResolvedValue({code: 200, data: {kvExactStatusAttr: [entry]}, message: 'OK'});

		expect(await query_get_kvexact_status(instance, key)).toEqual([entry]);
		expect(get).toHaveBeenCalledWith(
			instance,
			'/config/loadbalancer/externalipaddress/192.0.2.10/port/8000/protocol/tcp/kvexactstatus',
			undefined,
		);
	});

	it('sends model_name only when a model filter is given', async () => {
		get.mockResolvedValue({code: 200, data: {kvExactStatusAttr: []}, message: 'OK'});
		await query_get_kvexact_status(instance, {...key, modelName: 'Qwen/Qwen3-32B'});
		expect(get).toHaveBeenCalledWith(instance, expect.stringContaining('/kvexactstatus'), {model_name: 'Qwen/Qwen3-32B'});
	});

	it('answers 404 with null — "no KV-exact status for this selection" is data, not an error', async () => {
		get.mockResolvedValue({code: 404, data: {message: 'no kv-exact rule'}, message: 'Not Found'});
		expect(await query_get_kvexact_status(instance, key)).toBeNull();
	});

	it('throws on 422 so callers never auto-retry a malformed key', async () => {
		get.mockResolvedValue({code: 422, data: {message: 'bad port'}, message: 'Unprocessable'});
		await expect(query_get_kvexact_status(instance, key)).rejects.toMatchObject({status: 422});
	});

	it('re-throws non-404 transport failures untouched', async () => {
		get.mockRejectedValue(new ApiError('boom', 503));
		await expect(query_get_kvexact_status(instance, key)).rejects.toMatchObject({status: 503});
	});
});
