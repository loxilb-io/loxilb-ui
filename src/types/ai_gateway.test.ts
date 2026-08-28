import {describe, expect, it} from 'vitest';
import {
	allowedAIHashes,
	effectiveAIHash,
	hasRequiredApiKeyPolicy,
	isAIEngineChange,
	resolveAIEngine,
	resolveAITopology,
	serializeAIConfiguration,
	validateAIConfiguration,
} from './ai_gateway';
import {IEndpoint, IServiceArguments, IServiceConfiguration} from './load_balancer';

const endpoint = (overrides: Partial<IEndpoint> = {}): IEndpoint => ({
	endpointIP: '10.0.0.10',
	targetPort: 8000,
	weight: 1,
	state: '',
	counter: '',
	...overrides,
});

const configuration = (
	serviceArguments: Partial<IServiceArguments> = {},
	endpoints: IEndpoint[] = [endpoint()],
): IServiceConfiguration => ({
	serviceArguments: {
		name: 'ai-rule',
		externalIP: '192.0.2.10',
		inactiveTimeOut: 0,
		port: 8000,
		protocol: 'tcp',
		mode: 4,
		...serviceArguments,
	},
	endpoints,
	secondaryIPs: [],
	allowedSources: [],
});

const issueFields = (config: IServiceConfiguration): string[] =>
	validateAIConfiguration(config).map(issue => issue.field);

describe('AI Gateway engine policy', () => {
	it('detects only an explicit required API-key declaration as enforced configuration', () => {
		expect(hasRequiredApiKeyPolicy([configuration({api_key_auth: 'required'})])).toBe(true);
		expect(hasRequiredApiKeyPolicy([configuration(), configuration({api_key_auth: 'disabled'})])).toBe(false);
	});

	it('resolves the legacy empty engine as vLLM', () => {
		expect(resolveAIEngine()).toBe('vllm');
		expect(isAIEngineChange('', 'vllm')).toBe(false);
		expect(isAIEngineChange('vllm', 'sglang')).toBe(true);
	});

	it('derives a coherent hash without forcing it into the payload', () => {
		expect(effectiveAIHash('vllm')).toBe('sha256_cbor');
		expect(effectiveAIHash('sglang')).toBe('sha256_sglang');
		expect(effectiveAIHash('trtllm')).toBe('blockhash_trtllm');
		expect(effectiveAIHash('llamacpp')).toBeUndefined();
		expect(allowedAIHashes('vllm')).toEqual(['sha256_cbor', 'xxhash_cbor']);
	});

	it('derives topology from P/D and exact-mode settings', () => {
		expect(resolveAITopology({})).toBe('plain');
		expect(resolveAITopology({pd_disagg_mode: true, kvExactMode: 1})).toBe('pd');
		expect(resolveAITopology({pd_disagg_mode: false, kvExactMode: 3})).toBe('single-role');
	});
});

describe('AI Gateway validation matrix', () => {
	it('accepts vLLM P/D exact routing with roles, NIXL, and block parity', () => {
		const config = configuration(
			{kvEngineType: 'vllm', pd_disagg_mode: true, kvExactMode: 1, kvBlockSize: 16},
			[endpoint({ep_role: 1, nixl_port: 55555}), endpoint({endpointIP: '10.0.0.11', ep_role: 2, nixl_port: 55556})],
		);
		expect(validateAIConfiguration(config)).toEqual([]);
	});

	it('accepts the documented vLLM NIXL target-port fallback', () => {
		const omitted = configuration(
			{kvEngineType: 'vllm', pd_disagg_mode: true},
			[endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		);
		const zero = configuration(
			{kvEngineType: 'vllm', pd_disagg_mode: true},
			[endpoint({ep_role: 1, nixl_port: 0}), endpoint({endpointIP: '10.0.0.11', ep_role: 2, nixl_port: 0})],
		);
		expect(validateAIConfiguration(omitted)).toEqual([]);
		expect(validateAIConfiguration(zero)).toEqual([]);
	});

	it('rejects invalid nonzero vLLM NIXL ports', () => {
		for (const nixl_port of [-1, 1.5, 65536]) {
			const fields = issueFields(configuration(
				{kvEngineType: 'vllm', pd_disagg_mode: true},
				[endpoint({ep_role: 1, nixl_port}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
			));
			expect(fields).toContain('endpoints');
		}
	});

	it('rejects reserved exact mode and exact routing outside fullproxy', () => {
		expect(issueFields(configuration({kvExactMode: 2}))).toContain('kvExactMode');
		expect(issueFields(configuration({mode: 0, kvExactMode: 3, kvBlockSize: 16}))).toContain('mode');
	});

	it('rejects incomplete P/D roles without requiring an explicit vLLM NIXL port', () => {
		const fields = issueFields(configuration(
			{pd_disagg_mode: true},
			[endpoint({ep_role: 1})],
		));
		expect(fields.filter(field => field === 'endpoints')).toHaveLength(1);
	});

	it('accepts SGLang P/D bootstrap and rejects it on other shapes', () => {
		const valid = configuration(
			{kvEngineType: 'sglang', pd_disagg_mode: true, pdBootstrapPort: 8998},
			[endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		);
		expect(validateAIConfiguration(valid)).toEqual([]);
		expect(issueFields(configuration({kvEngineType: 'sglang', pdBootstrapPort: 8998}))).toContain('pdBootstrapPort');
	});

	it('accepts role-less SGLang single-role exact routing', () => {
		const config = configuration({
			kvEngineType: 'sglang',
			kvExactMode: 3,
			kvBlockSize: 16,
			kvDpRankCount: 4,
		});
		expect(validateAIConfiguration(config)).toEqual([]);
	});

	it('accepts SGLang rank fan-out on both exact-routing topologies', () => {
		const pdExact = configuration(
			{kvEngineType: 'sglang', pd_disagg_mode: true, kvExactMode: 1, kvBlockSize: 16, kvZmqPort: 65528, kvDpRankCount: 8},
			[endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		);
		const singleRole = configuration({kvEngineType: 'sglang', kvExactMode: 3, kvBlockSize: 16, kvZmqPort: 65528, kvDpRankCount: 8});
		expect(validateAIConfiguration(pdExact)).toEqual([]);
		expect(validateAIConfiguration(singleRole)).toEqual([]);
	});

	it('rejects invalid ZMQ ports and SGLang rank fan-out overflow', () => {
		for (const kvZmqPort of [0, 65536, 5557.5]) {
			expect(issueFields(configuration({kvEngineType: 'sglang', kvExactMode: 3, kvBlockSize: 16, kvZmqPort}))).toContain('kvZmqPort');
		}
		expect(issueFields(configuration({kvEngineType: 'sglang', kvExactMode: 3, kvBlockSize: 16, kvZmqPort: 65529, kvDpRankCount: 8}))).toContain('kvZmqPort');
		expect(issueFields(configuration({kvEngineType: 'sglang', kvExactMode: 3, kvBlockSize: 16, kvDpRankCount: 0}))).toContain('kvDpRankCount');
		expect(issueFields(configuration({kvEngineType: 'sglang', kvExactMode: 3, kvBlockSize: 16, kvDpRankCount: 9}))).toContain('kvDpRankCount');
	});

	it('rejects roles on a single-role pool', () => {
		const config = configuration(
			{kvEngineType: 'sglang', kvExactMode: 3, kvBlockSize: 16},
			[endpoint({ep_role: 1})],
		);
		expect(issueFields(config)).toContain('endpoints');
	});

	it('requires TensorRT-LLM P/D exact mode and rejects its unused ZMQ control', () => {
		const fields = issueFields(configuration(
			{kvEngineType: 'trtllm', pd_disagg_mode: true, kvZmqPort: 6000, kvDpRankCount: 2},
			[endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		));
		expect(fields).toEqual(expect.arrayContaining(['kvExactMode', 'kvZmqPort']));
		expect(fields).not.toContain('kvDpRankCount');
	});

	it('allows materialized defaults for llama.cpp but rejects real KV controls', () => {
		const defaults = configuration({kvEngineType: 'llamacpp', kvBlockSize: 16, kvZmqPort: 5557, kvDpRankCount: 1});
		expect(validateAIConfiguration(defaults)).toEqual([]);

		const fields = issueFields(configuration({
			kvEngineType: 'llamacpp',
			kvExactMode: 3,
			kvBlockSize: 32,
			kvHashAlgo: 'sha256_cbor',
		}));
		expect(fields).toEqual(expect.arrayContaining(['kvExactMode', 'kvBlockSize', 'kvHashAlgo']));
	});

	it('rejects an engine/hash mismatch', () => {
		expect(issueFields(configuration({kvEngineType: 'sglang', kvHashAlgo: 'sha256_cbor'}))).toContain('kvHashAlgo');
	});

	it('enforces Swagger bounds for AI numeric fields that are sent', () => {
		const fields = issueFields(configuration(
			{
				chwbl_prefix_hash_level: 4,
				chwbl_prefix_hash_flags: 256,
				max_stream_duration_sec: -1,
				backend_keepalive_interval_sec: 1.5,
				pd_disagg_mode: true,
				pd_session_ttl_sec: -1,
				pd_cache_threshold: 101,
				pd_balance_abs_threshold: 1.5,
				kvExactMode: 1,
				kvBlockSize: 16,
				kvWarmupSec: -1,
			},
			[endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		));
		expect(fields).toEqual(expect.arrayContaining([
			'chwbl_prefix_hash_level',
			'chwbl_prefix_hash_flags',
			'max_stream_duration_sec',
			'backend_keepalive_interval_sec',
			'pd_session_ttl_sec',
			'pd_cache_threshold',
			'pd_balance_abs_threshold',
			'kvWarmupSec',
		]));
	});

	it('does not reject hidden numeric drafts that serialization removes', () => {
		const config = configuration({
			kvEngineType: 'sglang',
			kvDpRankCount: 99,
			kvWarmupSec: -1,
			pd_cache_threshold: 101,
		});
		expect(validateAIConfiguration(config)).toEqual([]);
		const payload = serializeAIConfiguration(config);
		expect(payload.serviceArguments).not.toHaveProperty('kvDpRankCount');
		expect(payload.serviceArguments).not.toHaveProperty('kvWarmupSec');
		expect(payload.serviceArguments).not.toHaveProperty('pd_cache_threshold');
	});
});

describe('AI Gateway wire serialization', () => {
	it('preserves all three API-key policy declarations without materializing a default', () => {
		const unmanaged = serializeAIConfiguration(configuration({api_key_auth: undefined}));
		const disabled = serializeAIConfiguration(configuration({api_key_auth: 'disabled'}));
		const required = serializeAIConfiguration(configuration({api_key_auth: 'required'}));

		expect(unmanaged.serviceArguments).not.toHaveProperty('api_key_auth');
		expect(disabled.serviceArguments.api_key_auth).toBe('disabled');
		expect(required.serviceArguments.api_key_auth).toBe('required');
	});

	it('strips API-key policy from non-fullproxy rules independently of streaming and topology', () => {
		const payload = serializeAIConfiguration(configuration({
			mode: 0,
			api_key_auth: 'required',
			sse_mode: true,
			pd_disagg_mode: true,
		}));
		expect(payload.serviceArguments).not.toHaveProperty('api_key_auth');
		expect(payload.serviceArguments).not.toHaveProperty('sse_mode');
	});

	it('strips AI defaults and endpoint roles from non-fullproxy rules', () => {
		const payload = serializeAIConfiguration(configuration(
			{mode: 0, kvEngineType: 'vllm', kvBlockSize: 16, kvZmqPort: 5557, kvDpRankCount: 1},
			[endpoint({ep_role: 1, nixl_port: 55555})],
		));
		expect(payload.serviceArguments).not.toHaveProperty('kvEngineType');
		expect(payload.serviceArguments).not.toHaveProperty('kvBlockSize');
		expect(payload.endpoints[0]).not.toHaveProperty('ep_role');
		expect(payload.endpoints[0]).not.toHaveProperty('nixl_port');
	});

	it('omits engine-derived hash and preserves SGLang P/D rank fan-out', () => {
		const payload = serializeAIConfiguration(configuration(
			{
				kvEngineType: 'sglang',
				pd_disagg_mode: true,
				kvExactMode: 1,
				kvBlockSize: 32,
				kvHashAlgo: undefined,
				kvDpRankCount: 4,
				pdBootstrapPort: 8998,
			},
			[endpoint({ep_role: 1, nixl_port: 55555}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		));
		expect(payload.serviceArguments).not.toHaveProperty('kvHashAlgo');
		expect(payload.serviceArguments.kvDpRankCount).toBe(4);
		expect(payload.serviceArguments.pdBootstrapPort).toBe(8998);
		expect(payload.endpoints[0]).not.toHaveProperty('nixl_port');
	});

	it('preserves SGLang single-role rank fan-out and clears it elsewhere', () => {
		const singleRole = serializeAIConfiguration(configuration({
			kvEngineType: 'sglang',
			kvExactMode: 3,
			kvBlockSize: 16,
			kvDpRankCount: 4,
		}));
		const vllm = serializeAIConfiguration(configuration({
			kvEngineType: 'vllm',
			kvExactMode: 3,
			kvBlockSize: 16,
			kvDpRankCount: 4,
		}));
		expect(singleRole.serviceArguments.kvDpRankCount).toBe(4);
		expect(vllm.serviceArguments).not.toHaveProperty('kvDpRankCount');
	});

	it('removes default-materialized KV controls from llama.cpp', () => {
		const payload = serializeAIConfiguration(configuration({
			kvEngineType: 'llamacpp',
			kvBlockSize: 16,
			kvZmqPort: 5557,
			kvDpRankCount: 1,
		}));
		expect(payload.serviceArguments.kvEngineType).toBe('llamacpp');
		expect(payload.serviceArguments).not.toHaveProperty('kvBlockSize');
		expect(payload.serviceArguments).not.toHaveProperty('kvZmqPort');
		expect(payload.serviceArguments).not.toHaveProperty('kvDpRankCount');
	});
});
