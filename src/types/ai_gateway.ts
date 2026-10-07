import type {GwSchema} from 'api';
import {serializeBackendTls} from './backend_tls';
import {IEndpoint, IServiceArguments, IServiceConfiguration, KvExactApiMode, requiresJwtProfile} from './load_balancer';

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

//---------------------------------------------------------
// Capacity admission gate (fc_*)
//---------------------------------------------------------
// Bounds mirror the gateway's validateFcGateFields / validateFcQueueFields
// (every numeric field is 0..max; 0 or omission leaves the process default in
// force). The gateway is the authority; these only keep a request that is
// certain to be refused inside the browser.
export const FC_NUMERIC_MAX = {
	fc_max_outstanding: 100000,
	fc_ep_max_inflight: 100000,
	fc_prefill_max_inflight: 100000,
	fc_decode_max_inflight: 100000,
	fc_max_queue_depth: 65536,
	fc_max_queue_wait_ms: 3600000,
	fc_telemetry_stale_ms: 3600000,
	fc_warmup_ms: 3600000,
	fc_ttft_target_ms: 3600000,
	fc_tenant_max_share_pct: 100,
} as const;
export type FcNumericField = keyof typeof FC_NUMERIC_MAX;
const FC_NUMERIC_FIELDS = Object.keys(FC_NUMERIC_MAX) as FcNumericField[];

const FC_MODES = ['off', 'observe', 'enforce', 'inherit'] as const;
const FC_ADAPTIVE = ['on', 'off', 'inherit'] as const;

/** Writable admission fields. fc_effective is read-only and not among them. */
export const FC_FIELDS: readonly (keyof IServiceArguments)[] = ['fc_mode', 'fc_adaptive', 'fc_expose_headers', ...FC_NUMERIC_FIELDS];

/**
 * The admission fields this instance's gateway declares in its own `/meta`.
 *
 * ⚠️ The vendored spec says what the NEWEST gateway accepts, not this one. An
 * older gateway answers 200 to a create carrying a field it does not know and
 * drops it, so a field offered without this check can be "saved" with no effect
 * and no error (seen live: a build with only the queue pair stored
 * fc_max_queue_depth and discarded fc_mode). `params` is the live /meta
 * `serviceArguments` field map; a field it omits is not offered.
 */
export function declaredFcFields(params: Record<string, unknown> | undefined): ReadonlySet<keyof IServiceArguments> {
	return new Set(FC_FIELDS.filter(field => params?.[field] !== undefined));
}

/** Fields that act only on a P/D pool (prefill/decode legs, the P/D scorers). */
export const FC_PD_ONLY_FIELDS: readonly FcNumericField[] = ['fc_prefill_max_inflight', 'fc_decode_max_inflight', 'fc_telemetry_stale_ms'];

/**
 * serviceArguments the gateway declares `readOnly`: returned on GET, ignored on
 * input, so never sent. Pinned against the vendored spec in
 * src/api/contract.test.ts — a new readOnly field fails that test until it is
 * listed here.
 */
export const READ_ONLY_SERVICE_ARGUMENTS: readonly (keyof IServiceArguments)[] = ['fc_effective', 'half_close_effective', 'backend_tls_effective'];

/**
 * Whether the gateway runs AI-gateway accounting — and so an admission pool —
 * for this rule. The gateway's one definition (aiGwModeFor): a fullproxy rule
 * with sse_mode, pd_disagg_mode, or a credential policy other than disabled.
 * An explicit `disabled` does not count; neither does an unset policy.
 */
export function isAIService(args: Pick<IServiceArguments, 'mode' | 'sse_mode' | 'pd_disagg_mode' | 'api_key_auth'>): boolean {
	if (args.mode !== 4) return false;
	return Boolean(args.sse_mode) || Boolean(args.pd_disagg_mode) || (!!args.api_key_auth && args.api_key_auth !== 'disabled');
}

/** The selectors that build a CHWBL hash ring: chwbl (8) and WRR-hash (10). */
export function isChwblSelector(sel: IServiceArguments['sel'] | ''): boolean {
	return sel === 8 || sel === 10;
}

/**
 * Ring tuning for the CHWBL selectors. The form shows these only on a
 * fullproxy rule under sel 8/10, and the gateway refuses a rule that carries
 * any of them anywhere else — an explicit `false` included, because it tracks
 * presence, not value. So they are sent only where they apply and only when
 * the operator set them; an omitted one resolves on the gateway.
 */
export const CHWBL_TUNING_FIELDS = ['chwbl_mean_load_factor', 'chwbl_replication', 'chwbl_enable_cache_salt'] as const;
export type ChwblTuningField = typeof CHWBL_TUNING_FIELDS[number];

/**
 * The tuning fields THIS gateway declares in its /meta. An older gateway
 * answers 200 to a create carrying one and drops it, which would leave a
 * control that saves and does nothing (see declaredFcFields).
 */
export function declaredChwblTuningFields(params: Record<string, unknown> | undefined): ReadonlySet<ChwblTuningField> {
	return new Set(CHWBL_TUNING_FIELDS.filter(field => params?.[field] !== undefined));
}

/** A form value that stands for "nothing declared": omitted on the wire. */
function isFcBlank(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

const AI_ONLY_FIELDS: readonly (keyof IServiceArguments)[] = [
	'model_name',
	'api_key_auth',
	'jwt_auth_profile',
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
	'pd_prefill_timeout_sec',
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
	'kvModelProfile',
	'kvExactApiMode',
	...FC_FIELDS,
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
	'pd_prefill_timeout_sec',
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

/**
 * The per-endpoint circuit breaker as it is, or will be, in force on a rule.
 *
 * The gateway resolves an omitted `cb_enable` when the rule is written: on for
 * a P/D rule, off otherwise; an explicit value is honoured as given. A draft
 * therefore shows that same resolution until the operator chooses, so the
 * switch never claims "off" for a rule that will be created with it on.
 *
 * ⚠️ A read-back is not a draft. GET reports the resolved state and omits the
 * field when the breaker is off — so on a P/D rule created with an explicit
 * `false`, absence means off, and applying the draft default there would show
 * a breaker that is not running.
 */
export function resolveCircuitBreaker(args: Pick<IServiceArguments, 'cb_enable' | 'pd_disagg_mode'>, readBack: boolean): boolean {
	if (readBack) return args.cb_enable === true;
	return args.cb_enable ?? Boolean(args.pd_disagg_mode);
}

/**
 * What an edit form seeded from a read-back must carry for the breaker.
 *
 * A fullproxy edit can only end as delete + create (a key change). GET omits
 * `cb_enable` when the breaker is off, and an omitted value on create resolves
 * to ON for a P/D rule — so the read-back is pinned explicitly, or recreating a
 * P/D rule whose breaker was switched off would silently switch it back on.
 * Nothing is pinned off fullproxy, where the field does not apply and an
 * in-place edit diffs the form against the read-back.
 */
export function circuitBreakerEditSeed(readBack: Pick<IServiceArguments, 'mode' | 'cb_enable'> | undefined): Pick<IServiceArguments, 'cb_enable'> {
	return readBack?.mode === 4 ? {cb_enable: resolveCircuitBreaker(readBack, true)} : {};
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
				!(field === 'kvDpRankCount' && value === 1) &&
				!((field === 'fc_mode' || field === 'fc_adaptive' || field === 'fc_expose_headers') && value === 'inherit');
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
	// CHWBL prefix hashing belongs to the CHWBL/WRR-hash selectors (sel 8/10).
	// The gateway silently DROPS these fields on any other selector (verified
	// live 2026-09-08: POST carried them, read-back returned None on sel=rr) —
	// accepting them there loses operator input without a word, so the form
	// blocks it honestly instead. '' is the level dropdown's "Not set"
	// placeholder — a form artifact, never operator intent.
	const chwblSelector = isChwblSelector(args.sel);
	if ((hasValue(args.chwbl_prefix_hash_level) || hasValue(args.chwbl_prefix_hash_flags)) && !chwblSelector) {
		issues.push({field: 'chwbl_prefix_hash_level', message: 'CHWBL prefix hash settings require the chwbl load-balancing algorithm (SEL); clear them or switch the algorithm.'});
	}
	if (hasValue(args.chwbl_prefix_hash_level) && ![1, 2, 3].includes(Number(args.chwbl_prefix_hash_level))) {
		issues.push({field: 'chwbl_prefix_hash_level', message: 'CHWBL prefix hash level must be 1, 2, or 3.'});
	}
	if (hasValue(args.chwbl_prefix_hash_flags) && (!isNonNegativeInteger(args.chwbl_prefix_hash_flags) || Number(args.chwbl_prefix_hash_flags) > 255)) {
		issues.push({field: 'chwbl_prefix_hash_flags', message: 'CHWBL prefix hash flags must be an integer between 0 and 255.'});
	}
	// Ring tuning is checked only where it is sent: off the CHWBL selectors
	// the controls are hidden and the serializer drops whatever the draft still
	// holds, so an issue there would block submit on a field nobody can see.
	if (chwblSelector) {
		const loadFactor = args.chwbl_mean_load_factor;
		if (hasValue(loadFactor) && (!isPositiveInteger(loadFactor) || loadFactor < 100 || loadFactor > 300)) {
			issues.push({field: 'chwbl_mean_load_factor', message: 'CHWBL mean load factor must be an integer between 100 and 300.'});
		}
		const replication = args.chwbl_replication;
		if (hasValue(replication) && (!isPositiveInteger(replication) || replication > 1024)) {
			issues.push({field: 'chwbl_replication', message: 'CHWBL replication must be an integer between 1 and 1024.'});
		}
		// Flags 0 means "every input the level allows", cache_salt included.
		// Explicit flags that leave bit 3 out contradict requiring the salt,
		// and the gateway refuses the pair.
		const flags = Number(args.chwbl_prefix_hash_flags);
		if (args.chwbl_enable_cache_salt === true && hasValue(args.chwbl_prefix_hash_flags) && flags !== 0 && (flags & 0x08) === 0) {
			issues.push({field: 'chwbl_enable_cache_salt', message: 'Requiring cache_salt needs the cache_salt input (flag bit 3, value 8) in CHWBL prefix hash flags, or flags left at 0.'});
		}
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
		if (args.pd_prefill_timeout_sec !== undefined && (!isNonNegativeInteger(args.pd_prefill_timeout_sec) || args.pd_prefill_timeout_sec > 3600)) {
			issues.push({field: 'pd_prefill_timeout_sec', message: 'P/D prefill timeout must be an integer between 0 and 3600.'});
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

	// Structural model-profile checks that need no registry: the contract
	// rejects both fields outside KV-exact routing outright.
	if (hasValue(args.kvModelProfile) && exactMode === 0) {
		issues.push({field: 'kvModelProfile', message: 'A model profile binds only to a KV-exact rule.'});
	}
	if (hasValue(args.kvExactApiMode)) {
		if (exactMode === 0) {
			issues.push({field: 'kvExactApiMode', message: 'An API surface declaration is meaningless without KV exact routing.'});
		}
		if (!KV_EXACT_API_MODES.includes(args.kvExactApiMode as KvExactApiMode)) {
			issues.push({field: 'kvExactApiMode', message: 'API surface must be completions, chat, or both.'});
		}
	}

	validateAdmissionFields(args, topology, issues);

	validateEndpointTopology(engine, topology, endpoints, issues);
	return issues;
}

// Only what the gateway would refuse. Fields the form hides (P/D-only fields on
// a non-P/D rule, any fc_* on a rule with no admission pool) are dropped by the
// serializer instead: blocking submit on a value the operator cannot see or
// clear would be worse than dropping a setting that has no effect there.
function validateAdmissionFields(args: IServiceArguments, topology: AITopology, issues: AIValidationIssue[]): void {
	if (!isAIService(args)) return;
	if (!isFcBlank(args.fc_mode) && !(FC_MODES as readonly unknown[]).includes(args.fc_mode)) {
		issues.push({field: 'fc_mode', message: 'Admission mode must be off, observe, enforce, or the gateway default.'});
	}
	if (!isFcBlank(args.fc_adaptive) && !(FC_ADAPTIVE as readonly unknown[]).includes(args.fc_adaptive)) {
		issues.push({field: 'fc_adaptive', message: 'Adaptive ceiling must be on, off, or the gateway default.'});
	}
	if (!isFcBlank(args.fc_expose_headers) && !(FC_ADAPTIVE as readonly unknown[]).includes(args.fc_expose_headers)) {
		issues.push({field: 'fc_expose_headers', message: 'Admission response headers must be on, off, or the gateway default.'});
	}
	for (const field of FC_NUMERIC_FIELDS) {
		if (topology !== 'pd' && FC_PD_ONLY_FIELDS.includes(field)) continue;
		const value = args[field];
		if (isFcBlank(value)) continue;
		// A value the form could not parse arrives as its raw text, so it is
		// refused here rather than dropped on the way to the wire.
		if (!isNonNegativeInteger(value) || value > FC_NUMERIC_MAX[field]) {
			issues.push({field, message: `${field} must be a whole number from 0 to ${FC_NUMERIC_MAX[field]}.`});
		}
	}
	// The gateway judges the pair on the stored values; a create stores exactly
	// what it sends, so the rule is the same here.
	if (isNonNegativeInteger(args.fc_max_queue_depth) && args.fc_max_queue_depth > 0 && !isPositiveInteger(args.fc_max_queue_wait_ms)) {
		issues.push({field: 'fc_max_queue_wait_ms', message: 'A queue depth needs a queue wait greater than 0 ms.'});
	}
}

function omitFields(args: IServiceArguments, fields: readonly (keyof IServiceArguments)[]): IServiceArguments {
	const result = {...args};
	for (const field of fields) delete result[field];
	return result;
}

// Blank means OMITTED, never 0: on these fields an explicit 0 resets to the
// process default and null is refused, so a blank form field must not reach
// the wire as either.
function serializeAdmissionFields(args: IServiceArguments, topology: AITopology): IServiceArguments {
	// No admission pool, no effect: the gateway stores the fields but no gate
	// reads them. Sending them would make a rule look configured when it is not.
	if (!isAIService(args)) return omitFields(args, FC_FIELDS);
	let result = {...args};
	for (const field of FC_FIELDS) {
		if (isFcBlank(result[field])) delete result[field];
	}
	if (topology !== 'pd') result = omitFields(result, FC_PD_ONLY_FIELDS);
	return result;
}

function stripEndpointAI(endpoint: IEndpoint): IEndpoint {
	const {ep_role, nixl_port, ...rest} = endpoint;
	return rest;
}

export function serializeAIConfiguration(configuration: IServiceConfiguration): IServiceConfiguration {
	const engine = resolveAIEngine(configuration.serviceArguments.kvEngineType);
	const topology = resolveAITopology(configuration.serviceArguments);
	// Read-only fields arrive through a form seeded from a read-back (the
	// key-changed "create" edit and the reconcile upsert both copy it). The
	// gateway ignores them on input; they never go on the wire.
	let serviceArguments = serializeBackendTls(omitFields({...configuration.serviceArguments}, READ_ONLY_SERVICE_ARGUMENTS));
	let endpoints = configuration.endpoints.map(endpoint => ({...endpoint}));

	if (serviceArguments.mode !== 4) {
		// The breaker switch is disabled off fullproxy, so a value left over
		// from an earlier mode choice in the same draft must not travel.
		serviceArguments = omitFields(serviceArguments, [...AI_ONLY_FIELDS, 'cb_enable', ...CHWBL_TUNING_FIELDS]);
		endpoints = endpoints.map(stripEndpointAI);
		return {...configuration, serviceArguments, endpoints};
	}

	// Omission is a real third policy state. Never materialize Swagger's
	// historical "disabled" default: absent preserves an unmanaged backend
	// X-Api-Key header, whereas explicit disabled strips it.
	//
	// ⚠️ On a REPLACE, omitting this PRESERVES the declared policy rather than
	// clearing it — so "unmanaged" is not a way back once a policy exists.
	// The form labels that honestly instead of implying otherwise; clearing
	// enforcement means sending "disabled".
	if (!serviceArguments.api_key_auth) delete serviceArguments.api_key_auth;

	// jwt_auth_profile travels WITH the mode and is valid only alongside the
	// two JWT modes. The gateway's own pairing matrix
	// (pkg/loxinet/rules_jwtprofile_test.go) fixes both directions:
	//   - a non-JWT mode carrying a profile is REFUSED
	//     (ErrJwtProfileNotApplicable), an unmanaged rule included, because a
	//     dangling reference blocks that profile's deletion for a rule that
	//     can never consult it;
	//   - a mode change away from JWT that OMITS the profile drops the old
	//     reference cleanly — which is why this deletes the key rather than
	//     sending an empty string.
	if (!requiresJwtProfile(serviceArguments.api_key_auth) || !serviceArguments.jwt_auth_profile) {
		delete serviceArguments.jwt_auth_profile;
	}

	if (!serviceArguments.kvHashAlgo) delete serviceArguments.kvHashAlgo;
	// The CHWBL level dropdown's "Not set" placeholder maps to '' — a form
	// artifact. An untouched or cleared CHWBL field must be ABSENT on the
	// wire, not empty (and never the old announce-injected level 1).
	if (!hasValue(serviceArguments.chwbl_prefix_hash_level)) delete serviceArguments.chwbl_prefix_hash_level;
	if (!hasValue(serviceArguments.chwbl_prefix_hash_flags)) delete serviceArguments.chwbl_prefix_hash_flags;
	// Ring tuning: gone entirely off the CHWBL selectors (hidden there, and
	// refused there by the gateway), and a cleared input is absent, not empty.
	if (!isChwblSelector(serviceArguments.sel)) {
		serviceArguments = omitFields(serviceArguments, CHWBL_TUNING_FIELDS);
	} else {
		for (const field of CHWBL_TUNING_FIELDS) {
			if (!hasValue(serviceArguments[field])) delete serviceArguments[field];
		}
	}
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

	serviceArguments = serializeAdmissionFields(serviceArguments, topology);

	// Last: the topology/engine rules above may have stripped kvExactMode, and
	// the profile fields must never outlive the exact routing they qualify.
	serviceArguments = serializeStrictProfileFields(serviceArguments);

	return {...configuration, serviceArguments, endpoints};
}

//---------------------------------------------------------
// KV-exact model-profile binding (read/select/status — never mutation)
//
// Types derive from the vendored gateway swagger (src/api/gen/gateway.ts)
// so they cannot drift from the live contract. The gateway POST is the
// admission authority; everything here is client-side convenience and
// pre-flight courtesy validation.
//---------------------------------------------------------

export type IModelProfileRegistry = GwSchema<'AiModelProfileRegistry'>;
export type IModelProfileEntry = GwSchema<'AiModelProfileEntry'>;
export type IKvExactStatusEntry = GwSchema<'KvExactStatusEntry'>;
export type IKvExactEnforcement = GwSchema<'KvExactEnforcement'>;

export const KV_EXACT_API_MODES: readonly KvExactApiMode[] = ['completions', 'chat', 'both'];

function hasValue(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '';
}

export type ProfileModelMatch = 'base' | 'alias';

/**
 * Whether a published profile admits a served model name, and how.
 * aliasPolicy is a closed set by contract: base_model_only or list — there
 * is no "any". An empty model name matches nothing (the caller filters only
 * when the rule declares a model).
 */
export function profileAcceptsModel(profile: IModelProfileEntry, modelName: string): ProfileModelMatch | null {
	if (!hasValue(modelName)) return null;
	if (profile.baseModel === modelName) return 'base';
	if (profile.aliasPolicy === 'list' && (profile.allowedAliases ?? []).includes(modelName)) return 'alias';
	return null;
}

/**
 * API surfaces selectable for a profile: each declared surface, plus "both"
 * only when the profile declares both. supportedApis is contractually
 * non-empty; unknown future surface strings pass through untouched so a
 * newer gateway does not brick the selector.
 */
export function allowedProfileApiModes(profile: IModelProfileEntry): KvExactApiMode[] {
	const apis = profile.supportedApis ?? [];
	const modes = KV_EXACT_API_MODES.filter(mode => mode !== 'both' && apis.includes(mode));
	if (apis.includes('completions') && apis.includes('chat')) modes.push('both');
	return modes;
}

/**
 * Pre-flight validation of a profile selection against the rule draft.
 * Field-level issues block the POST in the form (AC-05); the gateway POST
 * remains the final admission authority — this never replaces it.
 */
export function validateProfileSelection(
	args: Pick<IServiceArguments, 'model_name' | 'kvModelProfile' | 'kvExactApiMode' | 'kvExactMode'>,
	profile: IModelProfileEntry | undefined,
): AIValidationIssue[] {
	const issues: AIValidationIssue[] = [];
	if (!hasValue(args.kvModelProfile)) return issues;

	if ((args.kvExactMode ?? 0) === 0) {
		issues.push({field: 'kvModelProfile', message: 'A model profile binds only to a KV-exact rule.'});
	}
	if (!profile) {
		issues.push({field: 'kvModelProfile', message: 'Selected profile is not in the currently published registry. Refresh the profile list.'});
		return issues;
	}
	if (profile.profileId !== args.kvModelProfile) {
		issues.push({field: 'kvModelProfile', message: 'Selected profile does not match the profile entry being validated.'});
		return issues;
	}
	if (hasValue(args.model_name) && profileAcceptsModel(profile, args.model_name!) === null) {
		issues.push({field: 'kvModelProfile', message: `Profile ${profile.profileId} does not serve model ${args.model_name} (base model or allowed alias required).`});
	}
	if (hasValue(args.kvExactApiMode) && !allowedProfileApiModes(profile).includes(args.kvExactApiMode as KvExactApiMode)) {
		issues.push({field: 'kvExactApiMode', message: `API surface ${args.kvExactApiMode} is outside the profile's supported surfaces (${(profile.supportedApis ?? []).join(', ')}).`});
	}
	return issues;
}

/**
 * Serialize the strict-rule profile fields: exactly the two scalars when a
 * profile is bound to a KV-exact rule, neither otherwise.
 *
 * - No KV-exact routing (kvExactMode absent/0) → both fields dropped; the
 *   contract rejects them outright there.
 * - No profile → kvExactApiMode is also dropped. The contract does allow a
 *   surface declaration on a profile-less rule, but this UI never produces
 *   one: the selector derives its options from the bound profile, so a
 *   surviving orphan value could only be stale form state.
 * - Empty strings are form artifacts, never wire values.
 */
export function serializeStrictProfileFields(args: IServiceArguments): IServiceArguments {
	const result = {...args};
	if (!hasValue(result.kvModelProfile)) delete result.kvModelProfile;
	if (!hasValue(result.kvExactApiMode)) delete result.kvExactApiMode;

	const exactMode = result.kvExactMode ?? 0;
	if (exactMode === 0 || result.kvModelProfile === undefined) {
		delete result.kvModelProfile;
		delete result.kvExactApiMode;
	}
	return result;
}

//---------------------------------------------------------
// KV-exact enforcement status classification
//
// The state vocabulary is OPEN (x-kv-status-states, versioned by
// x-kv-status-vocabulary-version). Binding forward-compatibility rule from
// the contract: an unrecognized enforcedState MUST be treated as "not
// ready / in transition" and rendered raw; an unrecognized reasonCode MUST
// be rendered raw and MUST NOT be fatal.
//---------------------------------------------------------

export type KvExactReadinessKind =
	| 'legacy'
	| 'pending'
	| 'ready'
	| 'ready-functional-only'
	| 'degrading'
	| 'degraded'
	| 'fault'
	| 'requires-migration'
	| 'unknown';

export interface KvExactReadiness {
	kind: KvExactReadinessKind;
	/** Safe to render as Ready: a READY-class enforcedState AND an explicitly lifted fence (goFenced === false). POST 2xx and pending are never ready. */
	ready: boolean;
	/** READY_FUNCTIONAL_ONLY: functionally attested with no manifest trust root — always rendered with a warning, never as plain Ready. */
	warning: boolean;
	/** Tri-state fence passthrough: true = denied, false = explicitly lifted, undefined = unreported. false and undefined MUST render differently. */
	fenced?: boolean;
	/** Verbatim enforcedState for display — unknown vocabulary is shown raw, never remapped. */
	rawState: string;
}

const PENDING_STATES = new Set([
	'PROFILE_VALIDATED',
	'PENDING_DATAPLANE_CONTRACT',
	'TOKEN_PARITY_VERIFIED',
	'TOKEN_PARITY_NOT_AVAILABLE_WITH_APPROVED_ORACLE',
	'ENGINE_HASH_ATTESTED',
]);

function readinessKind(state: string): KvExactReadinessKind {
	if (state === 'LEGACY_ACTIVE_UNATTESTED') return 'legacy';
	if (PENDING_STATES.has(state)) return 'pending';
	if (state === 'READY') return 'ready';
	if (state === 'READY_FUNCTIONAL_ONLY') return 'ready-functional-only';
	if (state === 'DEGRADING') return 'degrading';
	if (state === 'DEGRADED') return 'degraded';
	if (state === 'ENFORCEMENT_FAULT') return 'fault';
	if (state === 'REQUIRES_MIGRATION') return 'requires-migration';
	return 'unknown';
}

export function classifyKvExactReadiness(entry: Pick<IKvExactStatusEntry, 'enforcedState' | 'enforcement'>): KvExactReadiness {
	const rawState = entry.enforcedState ?? '';
	const kind = readinessKind(rawState);
	const fenced = entry.enforcement?.goFenced;
	return {
		kind,
		ready: (kind === 'ready' || kind === 'ready-functional-only') && fenced === false,
		warning: kind === 'ready-functional-only',
		fenced,
		rawState,
	};
}

//---------------------------------------------------------
// Status polling cadence
//---------------------------------------------------------

export const KV_STATUS_POLL_FAST_MS = 5000;
export const KV_STATUS_POLL_STEADY_MS = 30000;

/**
 * Poll cadence for the enforcement status panel. Transitional states (and
 * "no data yet") poll fast; settled states — READY included — keep a slower
 * steady-state cadence, never zero: drift and degradation after READY must
 * still surface while the panel is visible. Callers stop polling entirely
 * only by unmounting/hiding the panel, not through this function.
 */
export function kvExactPollIntervalMs(entries: readonly IKvExactStatusEntry[] | null | undefined): number {
	if (entries === undefined) return KV_STATUS_POLL_FAST_MS;
	if (entries === null || entries.length === 0) return KV_STATUS_POLL_STEADY_MS;
	const transitional = entries.some(entry => {
		const kind = classifyKvExactReadiness(entry).kind;
		return kind === 'pending' || kind === 'degrading' || kind === 'unknown';
	});
	return transitional ? KV_STATUS_POLL_FAST_MS : KV_STATUS_POLL_STEADY_MS;
}
