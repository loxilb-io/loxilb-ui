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

// Declaration carried on an Inference Gateway fullproxy service. Omission is
// deliberately distinct from "disabled": omission leaves the backend's
// X-Api-Key namespace unmanaged, while explicit disabled claims and strips it.
export type ApiKeyAuthPolicy = 'disabled' | 'required';

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

	// NOTE: Octavia lifecycle/limit fields (id, adminStateUp, projectId,
	// connectionLimit, annotations, timeoutMember*, timeoutTcpInspect) are
	// intentionally EXCLUDED — unstable in the gateway (see gap doc §4).

	// --- AI gateway: model routing / tracing ---
	model_name?: string;			// endpoint-pool selector for AI model routing
	api_key_auth?: ApiKeyAuthPolicy;	// absent = preserve/unmanaged; disabled = strip; required = enforce + strip
	trace_type?: string;			// tracing catalog name for deep inspection
	session_header_name?: string;	// header carrying the session key (sel=persist)
	chwbl_prefix_hash_level?: number;	// CHWBL prefix hash level (sel=8)
	chwbl_prefix_hash_flags?: number;	// CHWBL prefix hash flags

	// --- AI gateway: SSE streaming ---
	sse_mode?: boolean;				// SSE streaming mode (suppress idle timeout)
	max_stream_duration_sec?: number;	// absolute SSE stream cap (0 = 24h)
	backend_keepalive_interval_sec?: number;	// SO_KEEPALIVE/TCP_KEEPIDLE on backend

	// --- AI gateway: prefill/decode disaggregation + KV-cache routing ---
	pd_disagg_mode?: boolean;		// vLLM prefill/decode disaggregation
	pd_cache_aware_mode?: boolean;	// P/D cache-aware routing (requires pd_disagg_mode)
	pd_session_ttl_sec?: number;	// session stickiness TTL for P/D
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
	}

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
