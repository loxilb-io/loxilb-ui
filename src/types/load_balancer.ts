import type {GwSchema} from '../api';
//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
// Frontend mTLS (client-certificate verification). Mirrors the gateway's
// serviceArguments.mtls_frontend schema. Only valid with mode=fullproxy and a
// TLS security (https/e2ehttps).
export interface IMtlsFrontend {
	// disabled: no verification (default) · optional: accept with/without cert ·
	// required: reject without a valid client cert.
	client_cert_mode?: 'disabled' | 'optional' | 'required';
	client_ca_path?: string;			// path to client CA bundle (PEM) on the gateway
	client_ca_cert_data?: string;		// inline base64 PEM (alternative to path)
	require_client_cn?: boolean;		// additionally require a CN pattern match
	client_cn_pattern?: string;			// CN pattern, wildcard supported (require_client_cn)
	client_crl_path?: string;			// optional static CRL (PEM) for leaf revocation
}

// Backend TLS as a rule asks for it. The other members the gateway still
// returns here are retired: they are neither offered nor read.
export interface IMtlsBackend {
	verify_server_cert?: boolean;		// verify every endpoint's certificate against backend_ca_cert_id
}

// Declaration carried on an Inference Gateway fullproxy service. Omission is
// deliberately distinct from "disabled": omission leaves the backend's
// X-Api-Key namespace unmanaged, while explicit disabled claims and strips it.
//
// The two bearer modes arrived with the JWT feature and both REQUIRE
// jwt_auth_profile to name a configured profile:
//   jwt            — an Authorization Bearer JWT decides; X-Api-Key is not consulted.
//   apikey-or-jwt  — fixed precedence, NOT "try both": a present X-Api-Key
//                    decides ALONE and its rejection is FINAL with no JWT
//                    fallback; only a request without the header falls through
//                    to the Bearer arm, and one carrying neither is refused.
export type ApiKeyAuthPolicy = 'disabled' | 'required' | 'jwt' | 'apikey-or-jwt';

/** The modes whose Bearer arm needs a profile to point at. */
export const JWT_AUTH_POLICIES: readonly ApiKeyAuthPolicy[] = ['jwt', 'apikey-or-jwt'];

export function requiresJwtProfile(policy: ApiKeyAuthPolicy | undefined): boolean {
	return policy !== undefined && JWT_AUTH_POLICIES.includes(policy);
}

// Declared KV-exact API surface of a strict rule. Absent on a profile-less
// rule keeps the legacy behavior (both surfaces, unattested); with a bound
// profile an explicit value must be a subset of the profile's supportedApis.
export type KvExactApiMode = 'completions' | 'chat' | 'both';

export interface IServiceArguments {
	name: string;
	id?: string;					// stable opaque Gateway rule identifier when available

	externalIP: string;
	inactiveTimeOut: number;
	port: number;
	protocol: string;
	privateIP?: string;
	portMax?: number;
	sel?: number;
	bgp?: boolean;
	monitor?: boolean;
	probetype?: string;
	probeport?: number;
	probereq?: string;
	proberesp?: string;
	managed?: boolean;				// Not required in Edit
	mode?: number;
	security?: number;
	block?: number;
	probeTimeout?: number;
	probeRetries?: number;
	snat?: boolean;
	oper?: number;
	host?: string;
	proxyprotocolv2?: boolean;
	egress?: boolean;
	path_prefix?: string;			// URL path prefix for L7 routing (e.g., /v1/users)
	path_match_mode?: 'disabled' | 'prefix' | 'exact';	// Path matching mode
	backend_protocol?: 'http1' | 'http2' | 'both';		// Backend protocol capability for ALPN negotiation
	mtls_frontend?: IMtlsFrontend;	// Frontend mTLS (client-cert verification); fullproxy + TLS only
	// Backend TLS leg; fullproxy + e2ehttps only (see types/backend_tls.ts).
	mtls_backend?: IMtlsBackend;
	backend_ca_cert_id?: string;		// /config/cert entry with usage "ca"; required by verify_server_cert
	backend_client_cert_id?: string;	// /config/cert entry with usage "client", presented to backends that ask
	backend_tls_server_name?: string;	// DNS name sent as SNI; a verified endpoint must carry it
	cb_enable?: boolean;			// per-endpoint circuit breaker; fullproxy only. Absent on create = gateway default (on for P/D, else off); absent on read-back = off

	// NOTE: Octavia lifecycle/limit fields (id, adminStateUp, projectId,
	// connectionLimit, annotations, timeoutMember*, timeoutTcpInspect) are
	// intentionally EXCLUDED — unstable in the gateway (see gap doc §4).

	// --- AI gateway: model routing / tracing ---
	model_name?: string;			// endpoint-pool selector for AI model routing
	api_key_auth?: ApiKeyAuthPolicy;	// absent = preserve/unmanaged; disabled = strip; required = enforce + strip; jwt / apikey-or-jwt = bearer arm
	jwt_auth_profile?: string;		// profile name the bearer arm resolves against; required by and only valid with the two JWT modes
	trace_type?: string;			// tracing catalog name for deep inspection
	session_header_name?: string;	// header carrying the session key (sel=persist)
	chwbl_prefix_hash_level?: number;	// CHWBL prefix hash level (sel=8)
	chwbl_prefix_hash_flags?: number;	// CHWBL prefix hash flags
	chwbl_mean_load_factor?: number;	// bounded-load factor in percent, 100..300 (sel=8/10; omitted = 175)
	chwbl_replication?: number;		// ring geometry, 1..1024: vnodes per endpoint (sel=8) or total vnode budget (sel=10); omitted = 256
	chwbl_enable_cache_salt?: boolean;	// require a cache_salt on every request and hash it (sel=8/10)

	// --- AI gateway: SSE streaming ---
	sse_mode?: boolean;				// SSE streaming mode (suppress idle timeout)
	max_stream_duration_sec?: number;	// absolute SSE stream cap (0 = 24h)
	backend_keepalive_interval_sec?: number;	// SO_KEEPALIVE/TCP_KEEPIDLE on backend

	// --- AI gateway: prefill/decode disaggregation + KV-cache routing ---
	pd_disagg_mode?: boolean;		// vLLM prefill/decode disaggregation
	pd_cache_aware_mode?: boolean;	// P/D cache-aware routing (requires pd_disagg_mode)
	pd_session_ttl_sec?: number;	// session stickiness TTL for P/D
	pd_prefill_timeout_sec?: number;	// P/D prefill wait bound, 0..3600 s (0 = gateway default)
	pd_cache_threshold?: number;	// P/D cache match threshold (0-100)
	pd_balance_abs_threshold?: number;	// P/D load-imbalance threshold
		kvExactMode?: number;			// KV-cache exact routing mode (0, 1, or 3; 2 is reserved)
		kvBlockSize?: number;			// token block size for KV hash (>=1)
		kvHashAlgo?: 'sha256_cbor' | 'xxhash_cbor' | 'sha256_sglang' | 'blockhash_trtllm';	// engine-coherent KV block hash algorithm
		kvZmqPort?: number;				// ZMQ PUB port on prefill endpoints (1-65535)
		kvWarmupSec?: number;			// inventory warmup before Tier-1.5 routing
		kvEngineType?: 'vllm' | 'sglang' | 'trtllm' | 'llamacpp';
		kvDpRankCount?: number;			// SGLang data-parallel rank count (1-8)
		pdBootstrapPort?: number;		// SGLang P/D bootstrap port (0 = engine default 8998)

		// --- AI gateway: KV-exact model-profile binding (strict rules) ---
		// Both are immutable after create (delete+recreate to change) and are
		// scalars by schema — arrays are rejected representations.
		kvModelProfile?: string;		// published ModelPromptProfile ID; absent = legacy profile-less rule
		kvExactApiMode?: KvExactApiMode;	// declared API surface; must be a subset of the bound profile's supportedApis

		// --- AI gateway: capacity admission gate (create / replace-POST only) ---
		// Blank is OMITTED (the gateway's environment or product default applies);
		// an explicit 0 resets to that default; null is refused. PATCH does not
		// reach fullproxy rules, so these change only by creating a rule.
		fc_mode?: GwServiceArguments['fc_mode'];
		fc_max_outstanding?: number;
		fc_ep_max_inflight?: number;
		fc_prefill_max_inflight?: number;	// P/D only
		fc_decode_max_inflight?: number;	// P/D only
		fc_max_queue_depth?: number;
		fc_max_queue_wait_ms?: number;		// required (> 0) whenever a depth is set
		fc_telemetry_stale_ms?: number;		// P/D only
		fc_adaptive?: GwServiceArguments['fc_adaptive'];
		/** Optional: offered only when the live Gateway metadata declares it. */
		fc_expose_headers?: 'on' | 'off' | 'inherit';
		fc_warmup_ms?: number;
		fc_ttft_target_ms?: number;
		fc_tenant_max_share_pct?: number;
		fc_effective?: IFcEffective;		// read-only: the gate's resolved state, never sent
		half_close_effective?: GwServiceArguments['half_close_effective'];	// read-only: the half-close mode in force, never sent
		sockMapMode?: GwServiceArguments['sockMapMode'];	// declared sockmap acceleration; shown on the rule detail, no form control
	}

type GwServiceArguments = NonNullable<GwSchema<'LoadbalanceEntry'>['serviceArguments']>;
/** The admission gate's resolved state on an AI rule's model pool (read-back only). */
export type IFcEffective = NonNullable<GwServiceArguments['fc_effective']>;

export interface IEndpoint {
	endpointIP: string;
	weight: number;
	targetPort: number;
	state: string;					// Not required in Edit
	counter: string;				// Not required in Edit

	// --- AI gateway: P/D disaggregation (gateway field parity) ---
	// Octavia member fields (backup, subnetId, monitorAddress, httpMethod,
	// urlPath, expectedCodes, httpVersion, domainName) are EXCLUDED — unstable.
	ep_role?: number;				// P/D role: 0 normal, 1 prefill, 2 decode
	nixl_port?: number;				// NIXL side-channel port for KV transfer
}

export interface ISecondaryIP {
	secondaryIP?: string;
}

export interface IAllowedSource {
	prefix: string; // ip address
}

export interface IServiceConfiguration {
	serviceArguments: IServiceArguments;
	endpoints: IEndpoint[];
	secondaryIPs: ISecondaryIP[];
	allowedSources: IAllowedSource[];
}

export interface ILBData {
	lbAttr: IServiceConfiguration[];
}
