import {IEndpoint, IServiceArguments, IServiceConfiguration} from './load_balancer';

export type AIEngine = NonNullable<IServiceArguments['kvEngineType']>;
export type AIHashAlgorithm = NonNullable<IServiceArguments['kvHashAlgo']>;
export type AITopology = 'plain' | 'pd' | 'single-role';

export interface AIValidationIssue {
	field: string;
	message: string;
}

export const AI_ENGINES: readonly AIEngine[] = ['vllm', 'sglang', 'trtllm', 'llamacpp'];
export const AI_HASH_ALGORITHMS: readonly AIHashAlgorithm[] = [
	'sha256_cbor',
	'xxhash_cbor',
	'sha256_sglang',
	'blockhash_trtllm',
];

const HASHES_BY_ENGINE: Record<AIEngine, readonly AIHashAlgorithm[]> = {
	vllm: ['sha256_cbor', 'xxhash_cbor'],
	sglang: ['sha256_sglang'],
	trtllm: ['blockhash_trtllm'],
	llamacpp: [],
};

const AI_ONLY_FIELDS: readonly (keyof IServiceArguments)[] = [
	'model_name',
	'api_key_auth',
	'trace_type',
	'session_header_name',
	'chwbl_prefix_hash_level',
	'chwbl_prefix_hash_flags',
	'sse_mode',
	'max_stream_duration_sec',
	'backend_keepalive_interval_sec',
	'pd_disagg_mode',
	'pd_cache_aware_mode',
	'pd_session_ttl_sec',
	'pd_cache_threshold',
	'pd_balance_abs_threshold',
	'kvExactMode',
	'kvBlockSize',
	'kvHashAlgo',
	'kvZmqPort',
	'kvWarmupSec',
	'kvEngineType',
	'kvDpRankCount',
	'pdBootstrapPort',
];

const KV_FIELDS: readonly (keyof IServiceArguments)[] = [
	'kvExactMode',
	'kvBlockSize',
	'kvHashAlgo',
	'kvZmqPort',
	'kvWarmupSec',
	'kvDpRankCount',
];

const PD_TUNING_FIELDS: readonly (keyof IServiceArguments)[] = [
	'pd_cache_aware_mode',
	'pd_session_ttl_sec',
	'pd_cache_threshold',
	'pd_balance_abs_threshold',
];

export function resolveAIEngine(engine?: IServiceArguments['kvEngineType'] | ''): AIEngine {
	return engine || 'vllm';
}

export function resolveAITopology(args: Pick<IServiceArguments, 'pd_disagg_mode' | 'kvExactMode'>): AITopology {
	if (args.pd_disagg_mode) return 'pd';
	if (args.kvExactMode === 3) return 'single-role';
	return 'plain';
}

export function effectiveAIHash(engine?: IServiceArguments['kvEngineType'] | ''): AIHashAlgorithm | undefined {
	switch (resolveAIEngine(engine)) {
		case 'vllm': return 'sha256_cbor';
		case 'sglang': return 'sha256_sglang';
		case 'trtllm': return 'blockhash_trtllm';
		case 'llamacpp': return undefined;
	}
}

export function allowedAIHashes(engine?: IServiceArguments['kvEngineType'] | ''): readonly AIHashAlgorithm[] {
	return HASHES_BY_ENGINE[resolveAIEngine(engine)];
}

export function hasRequiredApiKeyPolicy(configurations: readonly IServiceConfiguration[] = []): boolean {
	return configurations.some(configuration => configuration.serviceArguments.api_key_auth === 'required');
}

export function isAIEngineChange(
	original?: IServiceArguments['kvEngineType'] | '',
	incoming?: IServiceArguments['kvEngineType'] | '',
): boolean {
	return resolveAIEngine(original) !== resolveAIEngine(incoming);
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPort(value: unknown): value is number {
	return isPositiveInteger(value) && value <= 65535;
}

function isPortOrZero(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65535;
}

function validateEndpointTopology(
	engine: AIEngine,
	topology: AITopology,
	endpoints: readonly IEndpoint[],
	issues: AIValidationIssue[],
): void {
	if (topology === 'pd') {
		if (!endpoints.some(endpoint => endpoint.ep_role === 1)) {
			issues.push({field: 'endpoints', message: 'P/D topology requires at least one prefill endpoint (role 1).'});
		}
		if (!endpoints.some(endpoint => endpoint.ep_role === 2)) {
			issues.push({field: 'endpoints', message: 'P/D topology requires at least one decode endpoint (role 2).'});
		}
		if (engine === 'vllm' && endpoints.some(endpoint => endpoint.nixl_port !== undefined && !isPortOrZero(endpoint.nixl_port))) {
			issues.push({field: 'endpoints', message: 'A vLLM NIXL port must be omitted, 0, or a valid TCP port.'});
		}
		return;
	}

	if (endpoints.some(endpoint => endpoint.ep_role !== undefined && endpoint.ep_role !== 0)) {
		issues.push({field: 'endpoints', message: `${topology === 'single-role' ? 'Single-role' : 'Plain'} topology requires role-less endpoints.`});
	}
	if (endpoints.some(endpoint => endpoint.nixl_port !== undefined && endpoint.nixl_port !== 0)) {
		issues.push({field: 'endpoints', message: 'NIXL ports are valid only for vLLM P/D endpoints.'});
	}
}

export function validateAIConfiguration(configuration: IServiceConfiguration): AIValidationIssue[] {
	const args = configuration.serviceArguments;
	const endpoints = configuration.endpoints ?? [];
	const engine = resolveAIEngine(args.kvEngineType);
	const topology = resolveAITopology(args);
	const issues: AIValidationIssue[] = [];
	const exactMode = args.kvExactMode ?? 0;

	if (args.mode !== 4) {
		const active = AI_ONLY_FIELDS.some(field => {
			const value = args[field];
			return value !== undefined && value !== '' && value !== false && value !== 0 &&
				!(field === 'kvEngineType' && value === 'vllm') &&
				!(field === 'kvBlockSize' && value === 16) &&
				!(field === 'kvZmqPort' && value === 5557) &&
				!(field === 'kvDpRankCount' && value === 1);
		});
		if (active) issues.push({field: 'mode', message: 'AI Gateway routing requires full-proxy mode.'});
		return issues;
	}

	if (exactMode === 2 || ![0, 1, 3].includes(exactMode)) {
		issues.push({field: 'kvExactMode', message: 'KV exact mode must be 0, 1, or 3; mode 2 is reserved.'});
	}
	if (exactMode === 1 && topology !== 'pd') {
		issues.push({field: 'kvExactMode', message: 'KV exact mode 1 requires P/D topology.'});
	}
	if (exactMode === 3 && topology !== 'single-role') {
		issues.push({field: 'kvExactMode', message: 'KV exact mode 3 requires a single-role topology.'});
	}
	if (topology === 'pd' && engine === 'trtllm' && exactMode !== 1) {
		issues.push({field: 'kvExactMode', message: 'TensorRT-LLM P/D requires KV exact mode 1.'});
	}
	if (topology === 'pd' && engine === 'llamacpp') {
		issues.push({field: 'pd_disagg_mode', message: 'llama.cpp does not support P/D disaggregation.'});
	}
	if (args.chwbl_prefix_hash_level !== undefined && ![1, 2, 3].includes(args.chwbl_prefix_hash_level)) {
		issues.push({field: 'chwbl_prefix_hash_level', message: 'CHWBL prefix hash level must be 1, 2, or 3.'});
	}
	if (args.chwbl_prefix_hash_flags !== undefined && (!isNonNegativeInteger(args.chwbl_prefix_hash_flags) || args.chwbl_prefix_hash_flags > 255)) {
		issues.push({field: 'chwbl_prefix_hash_flags', message: 'CHWBL prefix hash flags must be an integer between 0 and 255.'});
	}
	if (args.max_stream_duration_sec !== undefined && !isNonNegativeInteger(args.max_stream_duration_sec)) {
		issues.push({field: 'max_stream_duration_sec', message: 'Max stream duration must be a non-negative integer.'});
	}
	if (args.backend_keepalive_interval_sec !== undefined && !isNonNegativeInteger(args.backend_keepalive_interval_sec)) {
		issues.push({field: 'backend_keepalive_interval_sec', message: 'Backend keepalive interval must be a non-negative integer.'});
	}
	if (topology === 'pd') {
		if (args.pd_session_ttl_sec !== undefined && !isNonNegativeInteger(args.pd_session_ttl_sec)) {
			issues.push({field: 'pd_session_ttl_sec', message: 'P/D session TTL must be a non-negative integer.'});
		}
		if (args.pd_cache_threshold !== undefined && (!isNonNegativeInteger(args.pd_cache_threshold) || args.pd_cache_threshold > 100)) {
			issues.push({field: 'pd_cache_threshold', message: 'P/D cache threshold must be an integer between 0 and 100.'});
		}
		if (args.pd_balance_abs_threshold !== undefined && !isNonNegativeInteger(args.pd_balance_abs_threshold)) {
			issues.push({field: 'pd_balance_abs_threshold', message: 'P/D balance threshold must be a non-negative integer.'});
		}
	}

	if (exactMode !== 0 && !isPositiveInteger(args.kvBlockSize)) {
		issues.push({field: 'kvBlockSize', message: 'KV exact routing requires a positive engine-matched block/page size.'});
	}
	if (exactMode !== 0 && args.kvWarmupSec !== undefined && !isNonNegativeInteger(args.kvWarmupSec)) {
		issues.push({field: 'kvWarmupSec', message: 'KV warmup must be a non-negative integer.'});
	}
	if (args.kvHashAlgo && !allowedAIHashes(engine).includes(args.kvHashAlgo)) {
		issues.push({field: 'kvHashAlgo', message: `Hash algorithm ${args.kvHashAlgo} is incompatible with ${engine}.`});
	}
	if (args.pdBootstrapPort !== undefined && !isPortOrZero(args.pdBootstrapPort)) {
		issues.push({field: 'pdBootstrapPort', message: 'P/D bootstrap port must be 0 or a valid TCP port.'});
	}
	if ((args.pdBootstrapPort ?? 0) !== 0 && !(engine === 'sglang' && topology === 'pd')) {
		issues.push({field: 'pdBootstrapPort', message: 'P/D bootstrap port is valid only for SGLang P/D.'});
	}

	const usesExactEventRouting = topology === 'single-role' || (topology === 'pd' && exactMode === 1);
	const usesZmq = usesExactEventRouting && (engine === 'vllm' || engine === 'sglang');
	if (usesZmq && args.kvZmqPort !== undefined && !isPort(args.kvZmqPort)) {
		issues.push({field: 'kvZmqPort', message: 'KV ZMQ port must be between 1 and 65535.'});
	}
	const usesSGLangRankFanOut = engine === 'sglang' && usesExactEventRouting;
	if (usesSGLangRankFanOut) {
		const rankCount = args.kvDpRankCount ?? 1;
		const zmqPort = args.kvZmqPort ?? 5557;
		if (!isPositiveInteger(rankCount) || rankCount > 8) {
			issues.push({field: 'kvDpRankCount', message: 'KV DP rank count must be between 1 and 8.'});
		} else if (isPort(zmqPort) && zmqPort + rankCount - 1 > 65535) {
			issues.push({field: 'kvZmqPort', message: 'KV ZMQ rank fan-out must not exceed port 65535.'});
		}
	}

	if (engine === 'trtllm') {
		if (args.kvZmqPort !== undefined && ![0, 5557].includes(args.kvZmqPort)) {
			issues.push({field: 'kvZmqPort', message: 'TensorRT-LLM events use endpoint serving ports, not ZMQ.'});
		}
	}
	if (engine === 'llamacpp') {
		if (exactMode !== 0) issues.push({field: 'kvExactMode', message: 'llama.cpp has no KV event plane.'});
		if (args.kvHashAlgo) issues.push({field: 'kvHashAlgo', message: 'llama.cpp has no block-hash contract.'});
		if (args.kvZmqPort !== undefined && ![0, 5557].includes(args.kvZmqPort)) {
			issues.push({field: 'kvZmqPort', message: 'llama.cpp has no KV event transport.'});
		}
		if (args.kvBlockSize !== undefined && ![0, 16].includes(args.kvBlockSize)) {
			issues.push({field: 'kvBlockSize', message: 'llama.cpp has no gateway block table.'});
		}
	}

	validateEndpointTopology(engine, topology, endpoints, issues);
	return issues;
}

function omitFields(args: IServiceArguments, fields: readonly (keyof IServiceArguments)[]): IServiceArguments {
	const result = {...args};
	for (const field of fields) delete result[field];
	return result;
}

function stripEndpointAI(endpoint: IEndpoint): IEndpoint {
	const {ep_role, nixl_port, ...rest} = endpoint;
	return rest;
}

export function serializeAIConfiguration(configuration: IServiceConfiguration): IServiceConfiguration {
	const engine = resolveAIEngine(configuration.serviceArguments.kvEngineType);
	const topology = resolveAITopology(configuration.serviceArguments);
	let serviceArguments = {...configuration.serviceArguments};
	let endpoints = configuration.endpoints.map(endpoint => ({...endpoint}));

	if (serviceArguments.mode !== 4) {
		serviceArguments = omitFields(serviceArguments, AI_ONLY_FIELDS);
		endpoints = endpoints.map(stripEndpointAI);
		return {...configuration, serviceArguments, endpoints};
	}

	// Omission is a real third policy state. Never materialize Swagger's
	// historical "disabled" default: absent preserves an unmanaged backend
	// X-Api-Key header, whereas explicit disabled strips it.
	if (!serviceArguments.api_key_auth) delete serviceArguments.api_key_auth;

	if (!serviceArguments.kvHashAlgo) delete serviceArguments.kvHashAlgo;
	if (topology === 'plain') {
		serviceArguments = omitFields(serviceArguments, [...KV_FIELDS, 'pd_disagg_mode', ...PD_TUNING_FIELDS, 'pdBootstrapPort']);
		endpoints = endpoints.map(stripEndpointAI);
	} else if (topology === 'single-role') {
		serviceArguments = omitFields(serviceArguments, ['pd_disagg_mode', ...PD_TUNING_FIELDS, 'pdBootstrapPort']);
		endpoints = endpoints.map(stripEndpointAI);
	} else {
		if (serviceArguments.kvExactMode !== 1) serviceArguments = omitFields(serviceArguments, KV_FIELDS);
		if (engine !== 'sglang') delete serviceArguments.pdBootstrapPort;
		if (engine !== 'vllm') endpoints = endpoints.map(endpoint => {
			const {nixl_port, ...rest} = endpoint;
			return rest;
		});
	}

	const usesSGLangRankFanOut = engine === 'sglang' && (topology === 'single-role' || (topology === 'pd' && serviceArguments.kvExactMode === 1));
	if (!usesSGLangRankFanOut) delete serviceArguments.kvDpRankCount;
	if (engine === 'trtllm' || engine === 'llamacpp') delete serviceArguments.kvZmqPort;
	if (engine === 'llamacpp') serviceArguments = omitFields(serviceArguments, KV_FIELDS);

	return {...configuration, serviceArguments, endpoints};
}
