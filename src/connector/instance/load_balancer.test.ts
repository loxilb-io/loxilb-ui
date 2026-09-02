import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IServiceConfiguration} from 'types/load_balancer';
import {IInstance} from 'types/oam';
import {DELETE_INST, POST_INST} from '../fetcher/fetcher_inst';
import {request_create_load_balancer_config, request_delete_lb_by_full_key} from './load_balancer';

vi.mock('../fetcher/fetcher_inst', () => ({
	DELETE_INST: vi.fn(),
	GET_INST: vi.fn(),
	PATCH_INST: vi.fn(),
	POST_INST: vi.fn(),
}));

const instance = {id: 1, name: 'gateway'} as IInstance;
const baseConfiguration = (): IServiceConfiguration => ({
	serviceArguments: {
		name: 'ai-rule',
		externalIP: '192.0.2.10',
		inactiveTimeOut: 0,
		port: 8000,
		protocol: 'tcp',
		mode: 4,
	},
	endpoints: [{endpointIP: '10.0.0.10', targetPort: 8000, weight: 1, state: '', counter: ''}],
	secondaryIPs: [],
	allowedSources: [],
});

describe('load-balancer AI wire boundary', () => {
	const post = vi.mocked(POST_INST);

	beforeEach(() => {
		post.mockReset();
		post.mockResolvedValue({code: 200, data: null, message: ''});
	});

	it('does not send a known-invalid engine/topology combination', async () => {
		const data = baseConfiguration();
		data.serviceArguments.kvEngineType = 'llamacpp';
		data.serviceArguments.kvExactMode = 3;
		data.serviceArguments.kvBlockSize = 32;

		const result = await request_create_load_balancer_config(instance, data, 'inference-gateway');

		expect(result.status).toBe('invalid');
		// Field detail is diagnostics-only under OpResult (never rendered raw).
		expect(result.rawDetail).toContain('llama.cpp');
		expect(post).not.toHaveBeenCalled();
	});

	it('preserves SGLang P/D rank fan-out and strips endpoint fields the engine does not use', async () => {
		const data = baseConfiguration();
		data.serviceArguments.kvEngineType = 'sglang';
		data.serviceArguments.pd_disagg_mode = true;
		data.serviceArguments.kvExactMode = 1;
		data.serviceArguments.kvBlockSize = 32;
		data.serviceArguments.pdBootstrapPort = 8998;
		data.serviceArguments.kvDpRankCount = 4;
		data.endpoints = [
			{...data.endpoints[0], ep_role: 1, nixl_port: 55555},
			{...data.endpoints[0], endpointIP: '10.0.0.11', ep_role: 2},
		];

		const result = await request_create_load_balancer_config(instance, data, 'inference-gateway');

		expect(result.status).toBe('confirmed');
		expect(post).toHaveBeenCalledOnce();
		const payload = post.mock.calls[0][2] as IServiceConfiguration;
		expect(payload.serviceArguments.pdBootstrapPort).toBe(8998);
		expect(payload.serviceArguments.kvDpRankCount).toBe(4);
		expect(payload.endpoints[0]).not.toHaveProperty('nixl_port');
	});

	it('keeps plain non-AI rules backward compatible despite materialized defaults', async () => {
		const data = baseConfiguration();
		data.serviceArguments.mode = 0;
		data.serviceArguments.kvEngineType = 'vllm';
		data.serviceArguments.kvBlockSize = 16;
		data.serviceArguments.kvZmqPort = 5557;
		data.serviceArguments.kvDpRankCount = 1;

		const result = await request_create_load_balancer_config(instance, data, 'inference-gateway');

		expect(result.status).toBe('confirmed');
		const payload = post.mock.calls[0][2] as IServiceConfiguration;
		expect(payload.serviceArguments).not.toHaveProperty('kvEngineType');
		expect(payload.serviceArguments).not.toHaveProperty('kvBlockSize');
	});

	it('keeps absent, disabled and required API-key policies distinct on the wire', async () => {
		for (const policy of [undefined, 'disabled', 'required'] as const) {
			post.mockClear();
			const data = baseConfiguration();
			data.serviceArguments.api_key_auth = policy;

			await request_create_load_balancer_config(instance, data, 'inference-gateway');
			const payload = post.mock.calls[0][2] as IServiceConfiguration;
			if (policy === undefined) expect(payload.serviceArguments).not.toHaveProperty('api_key_auth');
			else expect(payload.serviceArguments.api_key_auth).toBe(policy);
		}
	});

	it('strips IGW auth and AI state before validating or sending to loxilb OSS', async () => {
		const data = baseConfiguration();
		data.serviceArguments.api_key_auth = 'required';
		data.serviceArguments.kvEngineType = 'llamacpp';
		data.serviceArguments.kvExactMode = 3;
		data.serviceArguments.kvBlockSize = 32;
		data.endpoints[0].ep_role = 1;
		data.endpoints[0].nixl_port = 5601;

		const result = await request_create_load_balancer_config(instance, data, 'loxilb');

		expect(result.status).toBe('confirmed');
		const payload = post.mock.calls[0][2] as IServiceConfiguration;
		expect(payload.serviceArguments).not.toHaveProperty('api_key_auth');
		expect(payload.serviceArguments).not.toHaveProperty('kvEngineType');
		expect(payload.serviceArguments).not.toHaveProperty('kvExactMode');
		expect(payload.serviceArguments).not.toHaveProperty('kvBlockSize');
		expect(payload.endpoints[0]).not.toHaveProperty('ep_role');
		expect(payload.endpoints[0]).not.toHaveProperty('nixl_port');
	});
});

describe('load-balancer full-key delete boundary', () => {
	const del = vi.mocked(DELETE_INST);

	beforeEach(() => {
		del.mockReset();
		del.mockResolvedValue({code: 204, data: null, message: ''});
	});

	it('sends model_name for a model-keyed non-host rule', async () => {
		const data = baseConfiguration();
		data.serviceArguments.name = '';
		data.serviceArguments.model_name = 'meta/llama 3';

		expect((await request_delete_lb_by_full_key(instance, data)).status).toBe('confirmed');
		expect(del).toHaveBeenCalledWith(
			instance,
			'/config/loadbalancer/externalipaddress/192.0.2.10/port/8000/protocol/tcp?model_name=meta%2Fllama+3',
		);
	});

	it('selects the host/range route and preserves path qualifiers', async () => {
		const data = baseConfiguration();
		Object.assign(data.serviceArguments, {
			name: '',
			host: 'api.example.test',
			portMax: 8010,
			path_prefix: '/v1/chat',
			path_match_mode: 'prefix',
			model_name: 'llama-3',
		});

		await request_delete_lb_by_full_key(instance, data);
		expect(del).toHaveBeenCalledWith(
			instance,
			'/config/loadbalancer/hosturl/api.example.test/externalipaddress/192.0.2.10/port/8000/portmax/8010/protocol/tcp?path_prefix=%2Fv1%2Fchat&path_match_mode=prefix&model_name=llama-3',
		);
	});
});
