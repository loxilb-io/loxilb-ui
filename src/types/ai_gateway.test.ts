import {describe, expect, it} from 'vitest';
import {
	CHWBL_TUNING_FIELDS,
	declaredChwblTuningFields,
	circuitBreakerEditSeed,
	declaredFcFields,
	allowedAIHashes,
	effectiveAIHash,
	FC_FIELDS,
	FC_NUMERIC_MAX,
	isAIService,
	declaredCredentials,
	isAIEngineChange,
	resolveAIEngine,
	resolveAITopology,
	resolveCircuitBreaker,
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
	describe('credentials the loaded services validate', () => {
		it('counts nothing for an omitted or disabled declaration', () => {
			expect(declaredCredentials()).toEqual({apiKey: false, jwt: false});
			expect(declaredCredentials([configuration(), configuration({api_key_auth: 'disabled'})])).toEqual({apiKey: false, jwt: false});
		});

		it('counts required as an API key only', () => {
			expect(declaredCredentials([configuration({api_key_auth: 'required'})])).toEqual({apiKey: true, jwt: false});
		});

		// The defect this replaces: a JWT service attributes tenants AND users,
		// and the old check read it as "nothing enforces".
		it('counts jwt as a token only — X-Api-Key is not consulted in that mode', () => {
			expect(declaredCredentials([configuration({api_key_auth: 'jwt', jwt_auth_profile: 'idp'})])).toEqual({apiKey: false, jwt: true});
		});

		it('counts apikey-or-jwt as both', () => {
			expect(declaredCredentials([configuration({api_key_auth: 'apikey-or-jwt', jwt_auth_profile: 'idp'})])).toEqual({apiKey: true, jwt: true});
		});

		it('adds up across services', () => {
			expect(declaredCredentials([
				configuration({api_key_auth: 'disabled'}),
				configuration({api_key_auth: 'required'}),
				configuration({api_key_auth: 'jwt', jwt_auth_profile: 'idp'}),
			])).toEqual({apiKey: true, jwt: true});
		});
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

	it('rejects CHWBL prefix hash settings on a non-CHWBL selector, admits them under sel chwbl (F-CHWBL)', () => {
		// The gateway silently drops these fields off sel 8/10 (verified live);
		// the form must refuse instead of losing operator input.
		expect(issueFields(configuration({chwbl_prefix_hash_level: 2}))).toContain('chwbl_prefix_hash_level');
		expect(issueFields(configuration({sel: 0, chwbl_prefix_hash_flags: 3}))).toContain('chwbl_prefix_hash_level');
		expect(validateAIConfiguration(configuration({sel: 8, chwbl_prefix_hash_level: 2, chwbl_prefix_hash_flags: 3}))).toEqual([]);
		// The level dropdown's "Not set" placeholder ('') is a form artifact,
		// never operator intent — no issue on any selector.
		expect(validateAIConfiguration(configuration({chwbl_prefix_hash_level: '' as unknown as number}))).toEqual([]);
	});

	it('strips unset/placeholder CHWBL fields from the wire and keeps real ones (F-CHWBL)', () => {
		const stripped = serializeAIConfiguration(configuration({chwbl_prefix_hash_level: '' as unknown as number})).serviceArguments;
		expect('chwbl_prefix_hash_level' in stripped).toBe(false);
		expect('chwbl_prefix_hash_flags' in stripped).toBe(false);

		const kept = serializeAIConfiguration(configuration({sel: 8, chwbl_prefix_hash_level: 2, chwbl_prefix_hash_flags: 0})).serviceArguments;
		expect(kept.chwbl_prefix_hash_level).toBe(2);
		// Flags 0 is a REAL value (empty bitmask), not "unset".
		expect(kept.chwbl_prefix_hash_flags).toBe(0);
	});

	it('bounds CHWBL ring tuning to the gateway ranges under the ring selectors', () => {
		const tuning = (over: Partial<IServiceArguments>) => issueFields(configuration({sel: 8, ...over}));
		for (const value of [100, 175, 300]) expect(tuning({chwbl_mean_load_factor: value})).toEqual([]);
		for (const value of [99, 301, 0, 150.5]) expect(tuning({chwbl_mean_load_factor: value})).toEqual(['chwbl_mean_load_factor']);
		for (const value of [1, 256, 1024]) expect(tuning({chwbl_replication: value})).toEqual([]);
		for (const value of [0, 1025, -1, 1.5]) expect(tuning({chwbl_replication: value})).toEqual(['chwbl_replication']);
		expect(issueFields(configuration({sel: 10, chwbl_mean_load_factor: 301, chwbl_replication: 1025}))).toEqual(['chwbl_mean_load_factor', 'chwbl_replication']);
		// A cleared input is "not set", not an out-of-range value.
		expect(tuning({chwbl_mean_load_factor: '' as unknown as number, chwbl_replication: '' as unknown as number})).toEqual([]);
	});

	it('does not block on ring tuning the form no longer shows', () => {
		// Off the ring selectors the controls are hidden and the serializer
		// drops the values, so an issue would name a field nobody can reach.
		const leftover = {chwbl_mean_load_factor: 999, chwbl_replication: 0, chwbl_enable_cache_salt: true, chwbl_prefix_hash_flags: 1};
		expect(issueFields(configuration({sel: 0, ...leftover}))).toEqual(['chwbl_prefix_hash_level']);
		expect(issueFields(configuration({mode: 0, sel: 8, chwbl_mean_load_factor: 999, chwbl_replication: 0, chwbl_enable_cache_salt: true}))).toEqual([]);
	});

	it('refuses a cache_salt requirement that explicit hash flags leave out', () => {
		const salted = (flags?: number) => issueFields(configuration({sel: 8, chwbl_enable_cache_salt: true, chwbl_prefix_hash_flags: flags}));
		// Flags 0 or unset select every input the level allows, cache_salt included.
		expect(salted()).toEqual([]);
		expect(salted(0)).toEqual([]);
		expect(salted(8)).toEqual([]);
		expect(salted(9)).toEqual([]);
		expect(salted(1)).toEqual(['chwbl_enable_cache_salt']);
		expect(salted(23)).toEqual(['chwbl_enable_cache_salt']);
		expect(issueFields(configuration({sel: 8, chwbl_enable_cache_salt: false, chwbl_prefix_hash_flags: 1}))).toEqual([]);
		expect(issueFields(configuration({sel: 8, chwbl_prefix_hash_flags: 1}))).toEqual([]);
	});

	it('sends ring tuning only under a ring selector on fullproxy, and only what was set', () => {
		const tuning = {chwbl_mean_load_factor: 125, chwbl_replication: 64, chwbl_enable_cache_salt: true};
		const wire = (over: Partial<IServiceArguments>) => serializeAIConfiguration(configuration(over)).serviceArguments;
		const carried = (args: IServiceArguments) => Object.keys(args).filter(key => key in tuning);

		for (const sel of [8, 10]) expect(wire({sel, ...tuning})).toMatchObject(tuning);
		// The gateway refuses ANY of them off sel 8/10 — an explicit false included.
		for (const sel of [0, 1, 3, 9, undefined]) expect(carried(wire({sel, ...tuning, chwbl_enable_cache_salt: false}))).toEqual([]);
		expect(carried(wire({mode: 0, sel: 8, ...tuning}))).toEqual([]);

		// Untouched stays absent so the gateway resolves it; a cleared input too.
		expect(carried(wire({sel: 8}))).toEqual([]);
		expect(carried(wire({sel: 8, chwbl_mean_load_factor: '' as unknown as number, chwbl_replication: 64}))).toEqual(['chwbl_replication']);
		// An explicit false is a choice and travels: on a replace, omission keeps the current value.
		expect(wire({sel: 8, chwbl_enable_cache_salt: false}).chwbl_enable_cache_salt).toBe(false);
	});

	it('reads the declared ring tuning fields from /meta', () => {
		expect([...declaredChwblTuningFields(undefined)]).toEqual([]);
		expect([...declaredChwblTuningFields({chwbl_replication: {type: 'integer'}, chwbl_prefix_hash_level: {}})]).toEqual(['chwbl_replication']);
		expect([...declaredChwblTuningFields({chwbl_mean_load_factor: {}, chwbl_replication: {}, chwbl_enable_cache_salt: {}})]).toEqual([...CHWBL_TUNING_FIELDS]);
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
				pd_prefill_timeout_sec: 3601,
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
			'pd_prefill_timeout_sec',
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

	// The two JWT modes and their profile reference. Every case below mirrors
	// a row of the gateway's own pairing matrix in
	// pkg/loxinet/rules_jwtprofile_test.go, because the failure mode is a 400
	// on save rather than anything the type system can catch.
	it('carries the profile with a JWT mode', () => {
		for (const mode of ['jwt', 'apikey-or-jwt'] as const) {
			const payload = serializeAIConfiguration(configuration({api_key_auth: mode, jwt_auth_profile: 'realm-a'}));
			expect(payload.serviceArguments.api_key_auth).toBe(mode);
			expect(payload.serviceArguments.jwt_auth_profile).toBe('realm-a');
		}
	});

	// A non-JWT mode carrying a profile is REFUSED upstream
	// (ErrJwtProfileNotApplicable) — an unmanaged rule included, because the
	// dangling reference would block that profile's deletion for a rule that
	// can never consult it.
	it('never sends a profile on a mode that cannot consult it', () => {
		for (const mode of ['disabled', 'required', undefined] as const) {
			const payload = serializeAIConfiguration(configuration({api_key_auth: mode, jwt_auth_profile: 'realm-a'}));
			expect(payload.serviceArguments).not.toHaveProperty('jwt_auth_profile');
		}
	});

	// "mode change away from jwt drops reference": switching to a non-JWT mode
	// must OMIT the field, which is what drops the old reference. Sending an
	// empty string instead would be a present-but-empty profile, and the
	// gateway refuses a non-JWT mode that carries one.
	it('drops the reference by omission when the mode moves away from JWT', () => {
		const payload = serializeAIConfiguration(configuration({api_key_auth: 'required', jwt_auth_profile: ''}));
		expect(payload.serviceArguments).not.toHaveProperty('jwt_auth_profile');
		expect(payload.serviceArguments.api_key_auth).toBe('required');
	});

	it('strips the profile from non-fullproxy rules along with the rest of the AI surface', () => {
		const payload = serializeAIConfiguration(configuration({mode: 0, api_key_auth: 'jwt', jwt_auth_profile: 'realm-a'}));
		expect(payload.serviceArguments).not.toHaveProperty('jwt_auth_profile');
		expect(payload.serviceArguments).not.toHaveProperty('api_key_auth');
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

	it('keeps the P/D prefill timeout on a P/D rule and drops it when the rule leaves P/D', () => {
		const pd = serializeAIConfiguration(configuration(
			{kvEngineType: 'vllm', pd_disagg_mode: true, pd_prefill_timeout_sec: 180},
			[endpoint({ep_role: 1, nixl_port: 55555}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		));
		expect(pd.serviceArguments.pd_prefill_timeout_sec).toBe(180);

		// The gateway refuses a nonzero timeout without pd_disagg_mode, so a
		// value left over from a P/D rule must not ride along.
		const plain = serializeAIConfiguration(configuration({pd_prefill_timeout_sec: 180}));
		expect(plain.serviceArguments).not.toHaveProperty('pd_prefill_timeout_sec');
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

//---------------------------------------------------------
// Capacity admission gate (fc_*)
//---------------------------------------------------------
const pdEndpoints = [endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})];
const sse = (fc: Partial<IServiceArguments> = {}) => configuration({sse_mode: true, ...fc});
const pd = (fc: Partial<IServiceArguments> = {}) => configuration({pd_disagg_mode: true, ...fc}, pdEndpoints);
const wire = (config: IServiceConfiguration) => serializeAIConfiguration(config).serviceArguments as unknown as Record<string, unknown>;
const fcKeys = (config: IServiceConfiguration) => Object.keys(wire(config)).filter(key => key.startsWith('fc_')).sort();

describe('isAIService (the gateway aiGwModeFor predicate)', () => {
	it('is true for a fullproxy rule with SSE, P/D, or a credential policy other than disabled', () => {
		expect(isAIService({mode: 4, sse_mode: true})).toBe(true);
		expect(isAIService({mode: 4, pd_disagg_mode: true})).toBe(true);
		for (const policy of ['required', 'jwt', 'apikey-or-jwt'] as const) expect(isAIService({mode: 4, api_key_auth: policy})).toBe(true);
	});

	it('is false for an explicit disabled policy, no policy, or a non-fullproxy rule', () => {
		expect(isAIService({mode: 4, api_key_auth: 'disabled'})).toBe(false);
		expect(isAIService({mode: 4})).toBe(false);
		expect(isAIService({mode: 0, sse_mode: true})).toBe(false);
	});
});

describe('admission serialization (blank is omitted, never 0 or null)', () => {
	it('sends no fc_* key when the group is untouched, blank, or cleared', () => {
		expect(fcKeys(sse())).toEqual([]);
		expect(fcKeys(sse({fc_mode: '' as any, fc_adaptive: '' as any, fc_max_outstanding: undefined, fc_max_queue_depth: null as any}))).toEqual([]);
	});

	it('sends exactly what was declared, and keeps an explicit 0 (reset to the process default)', () => {
		const body = wire(sse({fc_mode: 'observe', fc_max_outstanding: 64, fc_max_queue_depth: 8, fc_max_queue_wait_ms: 2000, fc_warmup_ms: 0}));
		expect(Object.fromEntries(Object.entries(body).filter(([key]) => key.startsWith('fc_')))).toEqual({
			fc_mode: 'observe', fc_max_outstanding: 64, fc_max_queue_depth: 8, fc_max_queue_wait_ms: 2000, fc_warmup_ms: 0,
		});
	});

	it('never sends the read-only fc_effective, whatever the rule shape', () => {
		const fc_effective = {mode: 'observe', inflight: 3, queued: 1, source: {mode: 'rule'}} as any;
		for (const config of [sse({fc_effective}), pd({fc_effective}), configuration({mode: 0, fc_effective}), configuration({fc_effective})]) {
			expect(wire(config)).not.toHaveProperty('fc_effective');
		}
	});

	it('drops the P/D-only fields on a rule that is not P/D, and keeps them on P/D', () => {
		const pdOnly = {fc_prefill_max_inflight: 4, fc_decode_max_inflight: 8, fc_telemetry_stale_ms: 500};
		expect(fcKeys(sse({...pdOnly, fc_max_outstanding: 64}))).toEqual(['fc_max_outstanding']);
		expect(fcKeys(pd(pdOnly))).toEqual(['fc_decode_max_inflight', 'fc_prefill_max_inflight', 'fc_telemetry_stale_ms']);
	});

	it('drops every fc_* on a rule with no admission pool (no gate reads them there)', () => {
		expect(fcKeys(configuration({fc_mode: 'enforce', fc_max_outstanding: 64}))).toEqual([]);
		expect(fcKeys(configuration({api_key_auth: 'disabled', fc_max_outstanding: 64}))).toEqual([]);
		expect(fcKeys(configuration({mode: 0, fc_max_outstanding: 64}))).toEqual([]);
	});
});

describe('backend TLS read-back serialization', () => {
	it('never sends the read-only backend_tls_effective, whatever the rule shape', () => {
		const backend_tls_effective = {status: 'applied', verify: true, ca: 'backend-ca', client_cert: true, client_cert_id: 'gateway-client', server_name: 'backend.internal', generation: 2} as any;
		const verified = {security: 2, mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: 'backend-ca', backend_client_cert_id: 'gateway-client', backend_tls_server_name: 'backend.internal'} as Partial<IServiceArguments>;
		for (const config of [
			configuration({...verified, backend_tls_effective}),
			sse({...verified, backend_tls_effective}),
			pd({backend_tls_effective}),
			configuration({mode: 0, backend_tls_effective}),
			configuration({backend_tls_effective}),
		]) {
			expect(wire(config)).not.toHaveProperty('backend_tls_effective');
		}
		// The policy the rule asks for is not what is dropped.
		expect(wire(configuration({...verified, backend_tls_effective}))).toMatchObject({backend_ca_cert_id: 'backend-ca', backend_client_cert_id: 'gateway-client'});
	});
});

describe('admission validation (mirrors the gateway refusals)', () => {
	it('accepts every numeric field at 0 and at its maximum', () => {
		const atMax = Object.fromEntries(Object.entries(FC_NUMERIC_MAX)) as Partial<IServiceArguments>;
		expect(issueFields(pd(atMax))).toEqual([]);
		const atZero = Object.fromEntries(Object.keys(FC_NUMERIC_MAX).map(key => [key, 0])) as Partial<IServiceArguments>;
		expect(issueFields(pd(atZero))).toEqual([]);
	});

	it('refuses each numeric field one above its maximum, below 0, fractional, or as unparsed text', () => {
		for (const [field, max] of Object.entries(FC_NUMERIC_MAX)) {
			for (const bad of [max + 1, -1, 1.5, '12x']) {
				// Pair the queue fields so only the value under test is wrong.
				const pair = field === 'fc_max_queue_depth' ? {fc_max_queue_wait_ms: 1} : {};
				expect(issueFields(pd({...pair, [field]: bad} as any)), `${field}=${bad}`).toEqual([field]);
			}
		}
	});

	it('requires a queue wait above 0 whenever a depth above 0 is declared', () => {
		expect(issueFields(sse({fc_max_queue_depth: 8}))).toEqual(['fc_max_queue_wait_ms']);
		expect(issueFields(sse({fc_max_queue_depth: 8, fc_max_queue_wait_ms: 0}))).toEqual(['fc_max_queue_wait_ms']);
		expect(issueFields(sse({fc_max_queue_depth: 8, fc_max_queue_wait_ms: 1}))).toEqual([]);
		// Depth 0 resets to the process default: no window needed.
		expect(issueFields(sse({fc_max_queue_depth: 0}))).toEqual([]);
	});

	it('refuses a mode or adaptive word the gateway does not know', () => {
		expect(issueFields(sse({fc_mode: 'strict' as any}))).toEqual(['fc_mode']);
		expect(issueFields(sse({fc_adaptive: 'auto' as any}))).toEqual(['fc_adaptive']);
		expect(issueFields(sse({fc_mode: 'inherit', fc_adaptive: 'inherit'}))).toEqual([]);
	});

	it('does not block on fields the form hides: P/D-only on non-P/D, any fc_* without a pool', () => {
		expect(issueFields(sse({fc_prefill_max_inflight: '12x' as any}))).toEqual([]);
		expect(issueFields(configuration({fc_max_outstanding: '12x' as any}))).toEqual([]);
	});

	it('treats a declared admission field on a non-fullproxy rule as AI configuration, but not inherit', () => {
		expect(issueFields(configuration({mode: 0, fc_max_outstanding: 64}))).toEqual(['mode']);
		expect(issueFields(configuration({mode: 0, fc_mode: 'inherit', fc_adaptive: 'inherit'}))).toEqual([]);
	});

	it('lists every writable spec field and nothing read-only', () => {
		expect([...FC_FIELDS].sort()).toEqual([
			'fc_adaptive', 'fc_decode_max_inflight', 'fc_ep_max_inflight', 'fc_expose_headers', 'fc_max_outstanding', 'fc_max_queue_depth',
			'fc_max_queue_wait_ms', 'fc_mode', 'fc_prefill_max_inflight', 'fc_telemetry_stale_ms', 'fc_tenant_max_share_pct',
			'fc_ttft_target_ms', 'fc_warmup_ms',
		]);
	});
});

describe('declaredFcFields (what this gateway\'s /meta offers)', () => {
	it('keeps only the fields the live /meta declares, and never fc_effective', () => {
		const got = declaredFcFields({fc_max_queue_depth: {type: 'integer'}, fc_max_queue_wait_ms: {type: 'integer'}, fc_effective: {}, name: {}});
		expect([...got].sort()).toEqual(['fc_max_queue_depth', 'fc_max_queue_wait_ms']);
	});

	it('declares nothing when /meta has not loaded or predates admission', () => {
		expect(declaredFcFields(undefined).size).toBe(0);
		expect(declaredFcFields({}).size).toBe(0);
	});
});

 describe('admission response header declaration', () => {
	it('preserves declared modes, omits blank input, and rejects unknown modes', () => {
		for (const mode of ['on', 'off', 'inherit'] as const) {
			const config = configuration({sse_mode: true, fc_expose_headers: mode});
			expect(serializeAIConfiguration(config).serviceArguments.fc_expose_headers).toBe(mode);
			expect(validateAIConfiguration(config)).toEqual([]);
		}
		expect(serializeAIConfiguration(configuration({sse_mode: true, fc_expose_headers: '' as any})).serviceArguments).not.toHaveProperty('fc_expose_headers');
		expect(validateAIConfiguration(configuration({sse_mode: true, fc_expose_headers: 'always' as any})).map(issue => issue.field)).toContain('fc_expose_headers');
		expect(serializeAIConfiguration(configuration({mode: 0, fc_expose_headers: 'on'})).serviceArguments).not.toHaveProperty('fc_expose_headers');
	});
	it('requires a live field declaration', () => {
		expect(declaredFcFields({fc_expose_headers: {type: 'string'}}).has('fc_expose_headers')).toBe(true);
		expect(declaredFcFields({}).has('fc_expose_headers')).toBe(false);
	});
});

describe('circuit breaker resolution', () => {
	it('shows an untouched draft the way the gateway resolves an omitted value', () => {
		expect(resolveCircuitBreaker({pd_disagg_mode: true}, false)).toBe(true);
		expect(resolveCircuitBreaker({pd_disagg_mode: false}, false)).toBe(false);
		expect(resolveCircuitBreaker({}, false)).toBe(false);
	});

	it('honours an explicit choice against the topology default', () => {
		expect(resolveCircuitBreaker({pd_disagg_mode: true, cb_enable: false}, false)).toBe(false);
		expect(resolveCircuitBreaker({pd_disagg_mode: false, cb_enable: true}, false)).toBe(true);
	});

	// GET omits the field when the breaker is off. A P/D rule created with an
	// explicit false therefore reads back with no cb_enable at all.
	it('reads an absent value on a read-back as off, P/D rule included', () => {
		expect(resolveCircuitBreaker({pd_disagg_mode: true}, true)).toBe(false);
		expect(resolveCircuitBreaker({pd_disagg_mode: true, cb_enable: true}, true)).toBe(true);
	});

	it('sends nothing for an untouched draft and keeps an explicit false on the wire', () => {
		const pd = {kvEngineType: 'vllm', pd_disagg_mode: true} as const;
		const roles = [endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})];
		expect(serializeAIConfiguration(configuration(pd, roles)).serviceArguments).not.toHaveProperty('cb_enable');
		expect(serializeAIConfiguration(configuration({...pd, cb_enable: false}, roles)).serviceArguments.cb_enable).toBe(false);
		expect(serializeAIConfiguration(configuration({cb_enable: true})).serviceArguments.cb_enable).toBe(true);
	});

	it('does not carry a choice made under fullproxy onto another mode', () => {
		expect(serializeAIConfiguration(configuration({mode: 0, cb_enable: true})).serviceArguments).not.toHaveProperty('cb_enable');
	});

	// Recreating a P/D rule from its read-back: the omitted value would resolve
	// to ON at the gateway, undoing an explicit off.
	it('pins the read-back state for a fullproxy edit so a recreate cannot flip it', () => {
		expect(circuitBreakerEditSeed({mode: 4})).toEqual({cb_enable: false});
		expect(circuitBreakerEditSeed({mode: 4, cb_enable: true})).toEqual({cb_enable: true});
		const recreated = serializeAIConfiguration(configuration(
			{kvEngineType: 'vllm', pd_disagg_mode: true, ...circuitBreakerEditSeed({mode: 4})},
			[endpoint({ep_role: 1}), endpoint({endpointIP: '10.0.0.11', ep_role: 2})],
		));
		expect(recreated.serviceArguments.cb_enable).toBe(false);
	});

	it('pins nothing off fullproxy, where an in-place edit diffs against the read-back', () => {
		expect(circuitBreakerEditSeed({mode: 0})).toEqual({});
		expect(circuitBreakerEditSeed({mode: 0, cb_enable: true})).toEqual({});
		expect(circuitBreakerEditSeed(undefined)).toEqual({});
	});
});
