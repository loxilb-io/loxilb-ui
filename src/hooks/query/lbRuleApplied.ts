//---------------------------------------------------------
// "Did my rule write land?" — by value, for the inference gateway.
//
// `lbRuleAppeared` answers with the rule's identity alone, so a rule that was
// already listed confirms any update to it, landed or not. This predicate adds
// the values: the row with the submitted identity must also read back with
// what was sent.
//
// What it reads: the rule list (`GET /config/loadbalancer/all`) and nothing
// else. It is a statement about stored configuration only. Whether a listener
// installed that configuration (`fc_effective`, `backend_tls_effective`,
// `half_close_effective`, endpoint `state`) is a different observation and is
// never part of it.
//
// Three rules keep it from failing a write that did land:
//
//   1. Only what was SENT is compared. A field the body leaves out is either
//      preserved by the gateway (`api_key_auth`, `fc_*`, …) or none of this
//      write's business (a merge-patch), so it says nothing about the write.
//   2. A zero value and an absent one are the same answer. The gateway omits
//      nearly every zero, false and empty field from its read-back, and an
//      empty list reads back as `null`.
//   3. Each field is compared the way the gateway is known to return it —
//      see LB_FIELD_CONFIRMATION. A field whose read-back was not verified in
//      the gateway source is NOT compared, and says so, rather than guessed.
//
// The table was read from the gateway's rule serializer and store. It applies
// to the inference gateway only; upstream loxilb is a different server and
// keeps the identity-only predicate.
//---------------------------------------------------------
import {IServiceConfiguration} from 'types/load_balancer';

/** How one `serviceArguments` field takes part in the confirmation. */
export type LBFieldConfirmation =
	/** Part of which rule this is; matched before any value is looked at. */
	| {kind: 'identity'}
	/** Stored and returned as sent. Zero and absent are equal. */
	| {kind: 'echo'}
	/** As `echo`, and `absentAs` is what the gateway means by leaving it out. */
	| {kind: 'echo'; absentAs: string}
	/** As `echo`, but the gateway only returns it on a fullproxy (mode 4) rule. */
	| {kind: 'echo'; absentAs: string; fullproxyOnly: true}
	/** A zero is replaced by a server default, so only a non-zero value is compared. */
	| {kind: 'nonzero'}
	/** An object, compared on these members only. */
	| {kind: 'members'; members: readonly string[]}
	/** Applied by the tuple PATCH but not stored by a POST. */
	| {kind: 'patch-only'}
	/** Never compared; `why` is the reason. */
	| {kind: 'skip'; why: string};

const echo: LBFieldConfirmation = {kind: 'echo'};
const identity: LBFieldConfirmation = {kind: 'identity'};
const skip = (why: string): LBFieldConfirmation => ({kind: 'skip', why});

const WRITE_ONLY = 'accepted but never returned by the rule read';
const SERVER_OWNED = 'set or derived by the gateway, not by the request';
const READ_ONLY = 'read-only observation of the data plane';
const UNVERIFIED = 'read-back behaviour not verified in the gateway source';

/**
 * Every `serviceArguments` property of the gateway contract, classified.
 * `contract.test.ts` fails when the vendored spec gains a property that is not
 * listed here, so a new field is a decision and never a silent default.
 */
export const LB_FIELD_CONFIRMATION: Readonly<Record<string, LBFieldConfirmation>> = {
	// Which rule.
	externalIP: identity,
	port: identity,
	portMax: identity,
	protocol: identity,
	host: identity,
	path_prefix: identity,
	path_match_mode: identity,
	model_name: identity,
	name: identity,
	block: identity,

	// Stored and returned as sent.
	sel: echo,
	mode: echo,
	security: echo,
	connectionLimit: echo,
	monitor: echo,
	probetype: echo,
	probeport: echo,
	probereq: echo,
	proberesp: echo,
	probeTimeout: echo,
	probeRetries: echo,
	proxyprotocolv2: echo,
	egress: echo,
	trace_type: echo,
	sse_mode: echo,
	api_key_auth: echo,
	jwt_auth_profile: echo,
	max_stream_duration_sec: echo,
	backend_keepalive_interval_sec: echo,
	cb_enable: echo,
	pd_disagg_mode: echo,
	pd_cache_aware_mode: echo,
	pd_session_ttl_sec: echo,
	pd_prefill_timeout_sec: echo,
	pd_cache_threshold: echo,
	pd_balance_abs_threshold: echo,
	fc_max_queue_depth: echo,
	fc_max_queue_wait_ms: echo,
	fc_max_outstanding: echo,
	fc_ep_max_inflight: echo,
	fc_prefill_max_inflight: echo,
	fc_decode_max_inflight: echo,
	fc_telemetry_stale_ms: echo,
	fc_warmup_ms: echo,
	fc_ttft_target_ms: echo,
	fc_tenant_max_share_pct: echo,
	backend_ca_cert_id: echo,
	backend_client_cert_id: echo,
	backend_tls_server_name: echo,

	// Stored as sent; the named value is what "left out" means.
	fc_mode: {kind: 'echo', absentAs: 'inherit'},
	fc_adaptive: {kind: 'echo', absentAs: 'inherit'},
	fc_expose_headers: {kind: 'echo', absentAs: 'inherit'},
	backend_protocol: {kind: 'echo', absentAs: 'http1', fullproxyOnly: true},
	sockMapMode: {kind: 'echo', absentAs: 'off', fullproxyOnly: true},
	half_close_mode: {kind: 'echo', absentAs: 'inherit', fullproxyOnly: true},

	// Zero asks for the protocol's default timeout, which then reads back.
	inactiveTimeOut: {kind: 'nonzero'},

	// `client_crl_path` is stored and never returned.
	mtls_frontend: {kind: 'members', members: ['client_cert_mode', 'client_ca_path', 'client_ca_cert_data', 'require_client_cn', 'client_cn_pattern']},
	// The path and inline-key members are refused by the gateway, never stored.
	mtls_backend: {kind: 'members', members: ['verify_server_cert']},

	adminStateUp: {kind: 'patch-only'},

	id: skip(SERVER_OWNED),
	snat: skip(SERVER_OWNED),
	managed: skip(SERVER_OWNED),
	bgp: skip('stored on create only; a replace does not change it'),
	projectId: skip('an empty value on a replace does not clear it'),
	annotations: skip('truncated by the gateway to a bounded set of keys and value length'),
	session_header_name: skip('returned only for the round-robin selectors'),
	privateIP: skip(WRITE_ONLY),
	oper: skip(WRITE_ONLY),
	timeoutMemberConnect: skip(WRITE_ONLY),
	timeoutMemberData: skip(WRITE_ONLY),
	timeoutTcpInspect: skip(WRITE_ONLY),
	vip_qos_policy_id: skip(WRITE_ONLY),
	alpn_protocols: skip(WRITE_ONLY),
	tls_ciphers: skip(WRITE_ONLY),
	tls_versions: skip(WRITE_ONLY),
	hsts_max_age: skip(WRITE_ONLY),
	hsts_include_subdomains: skip(WRITE_ONLY),
	hsts_preload: skip(WRITE_ONLY),
	fc_effective: skip(READ_ONLY),
	half_close_effective: skip(READ_ONLY),
	backend_tls_effective: skip(READ_ONLY),
	// A published model profile can own these, and their create-time defaults
	// were not traced.
	kvExactMode: skip(UNVERIFIED),
	kvBlockSize: skip(UNVERIFIED),
	kvHashAlgo: skip(UNVERIFIED),
	kvZmqPort: skip(UNVERIFIED),
	kvWarmupSec: skip(UNVERIFIED),
	kvEngineType: skip(UNVERIFIED),
	kvDpRankCount: skip(UNVERIFIED),
	kvExactApiMode: skip(UNVERIFIED),
	kvModelProfile: skip(UNVERIFIED),
	pdBootstrapPort: skip(UNVERIFIED),
	// Returned only on the consistent-hash selectors, and defaulted on create.
	chwbl_prefix_hash_level: skip(UNVERIFIED),
	chwbl_prefix_hash_flags: skip(UNVERIFIED),
	chwbl_mean_load_factor: skip(UNVERIFIED),
	chwbl_replication: skip(UNVERIFIED),
	chwbl_enable_cache_salt: skip(UNVERIFIED),
};

/** Endpoint members a replace is known to return as stored. Zero and absent are equal. */
const ENDPOINT_FIELDS = ['weight', 'ep_role', 'nixl_port', 'backup'] as const;

type Loose = Record<string, unknown>;

/** What the gateway leaves out of a read-back: nothing, zero, false, empty. */
function isZero(value: unknown): boolean {
	if (value === undefined || value === null || value === 0 || value === '' || value === false) return true;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === 'object') return Object.values(value as Loose).every(isZero);
	return false;
}

/** Submitted against served, with zero and absent equal and nothing else merged. */
function sameValue(asked: unknown, served: unknown): boolean {
	if (isZero(asked)) return isZero(served);
	if (Array.isArray(asked)) return Array.isArray(served) && asked.length === served.length && asked.every((item, i) => sameValue(item, served[i]));
	if (typeof asked === 'object') {
		if (typeof served !== 'object' || served === null) return false;
		return Object.entries(asked as Loose).every(([key, value]) => sameValue(value, (served as Loose)[key]));
	}
	return asked === served;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** A range is a range only when it reaches past the port; otherwise it is not returned. */
const portMaxOf = (args: Loose): number => (typeof args.portMax === 'number' && typeof args.port === 'number' && args.portMax > args.port ? args.portMax : 0);

/**
 * The row is the rule that was submitted: the same listener tuple, and the
 * same discriminators — including the ones the request left empty, so a
 * sibling that differs only by host, path or model is never taken for it.
 */
function sameRule(want: Loose, got: Loose): boolean {
	if (text(got.externalIP) !== text(want.externalIP)) return false;
	if (got.port !== want.port) return false;
	if (portMaxOf(got) !== portMaxOf(want)) return false;
	if (text(got.protocol).toLowerCase() !== text(want.protocol).toLowerCase()) return false;
	if (text(got.host) !== text(want.host)) return false;
	if (text(got.path_prefix) !== text(want.path_prefix)) return false;
	if (text(got.model_name) !== text(want.model_name)) return false;
	// "disabled" is stored as nothing, so it and absence are one mode.
	const mode = (args: Loose) => (text(args.path_match_mode) === 'disabled' ? '' : text(args.path_match_mode));
	if (mode(got) !== mode(want)) return false;
	// The gateway names a rule that was sent without a name, so a name is
	// compared only when the request chose one.
	if (text(want.name) !== '' && got.name !== want.name) return false;
	return (typeof want.block === 'number' ? want.block : 0) === (typeof got.block === 'number' ? got.block : 0);
}

function sameArguments(want: Loose, got: Loose, write: 'post' | 'patch'): boolean {
	const fullproxy = (want.mode ?? got.mode) === 4;
	return Object.entries(want).every(([field, asked]) => {
		// An own-property lookup: a field named like an Object.prototype member
		// must not find one.
		const rule = Object.prototype.hasOwnProperty.call(LB_FIELD_CONFIRMATION, field) ? LB_FIELD_CONFIRMATION[field] : undefined;
		// A field the contract does not declare was never classified.
		if (!rule) return true;
		const served = got[field];
		switch (rule.kind) {
			case 'identity':
			case 'skip':
				return true;
			case 'patch-only':
				return write !== 'patch' || sameValue(asked, served);
			case 'nonzero':
				return isZero(asked) || asked === served;
			case 'members':
				// An object of zeros is still a request: `verify_server_cert:
				// false` asks for verification to be off.
				if (asked === undefined || asked === null || typeof asked !== 'object') return true;
				return rule.members.every(member => !(member in (asked as Loose)) || sameValue((asked as Loose)[member], (served as Loose | undefined)?.[member]));
			case 'echo': {
				if ('fullproxyOnly' in rule && !fullproxy) return true;
				if (!('absentAs' in rule)) return sameValue(asked, served);
				const settle = (value: unknown) => (isZero(value) ? rule.absentAs : value);
				return settle(asked) === settle(served);
			}
			default:
				return true;
		}
	});
}

/** One backend, as the rule keys it. */
const endpointKey = (endpoint: Loose): string => `${text(endpoint.endpointIP)}|${endpoint.targetPort ?? ''}`;

/**
 * The endpoint list is replaced as a set, and the gateway returns it in its
 * own order, so the comparison is by address and port: every backend that was
 * sent is there with the values sent, and no other backend is.
 */
function sameEndpoints(asked: readonly Loose[], served: readonly Loose[] | null | undefined): boolean {
	const want = new Map(asked.map(endpoint => [endpointKey(endpoint), endpoint]));
	const got = new Map((served ?? []).map(endpoint => [endpointKey(endpoint), endpoint]));
	if (want.size !== got.size) return false;
	return Array.from(want).every(([key, endpoint]) => {
		const row = got.get(key);
		return row !== undefined && ENDPOINT_FIELDS.every(field => !(field in endpoint) || sameValue(endpoint[field], row[field]));
	});
}

/**
 * A source prefix as the gateway returns it: the network, host bits cleared
 * (`10.1.2.3/24` reads back `10.1.2.0/24`). IPv6 is compared as written.
 */
export function canonicalSourcePrefix(prefix: string): string {
	const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(prefix.trim());
	if (!match) return prefix.trim().toLowerCase();
	const bits = Number(match[5]);
	const octets = match.slice(1, 5).map(Number);
	if (bits > 32 || octets.some(octet => octet > 255)) return prefix.trim();
	const address = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
	const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
	const network = (address & mask) >>> 0;
	return `${[network >>> 24, (network >>> 16) & 255, (network >>> 8) & 255, network & 255].join('.')}/${bits}`;
}

const sortedTexts = (values: readonly string[]): string => JSON.stringify([...values].sort());

const sameSources = (asked: readonly Loose[], served: readonly Loose[] | null | undefined): boolean =>
	sortedTexts(asked.map(source => canonicalSourcePrefix(text(source.prefix)))) === sortedTexts((served ?? []).map(source => canonicalSourcePrefix(text(source.prefix))));

const sameSecondaryIPs = (asked: readonly Loose[], served: readonly Loose[] | null | undefined): boolean =>
	sortedTexts(asked.map(ip => text(ip.secondaryIP))) === sortedTexts((served ?? []).map(ip => text(ip.secondaryIP)));

/** The members of a read rule that say which rule it is, and nothing else. */
export function lbRuleIdentityArguments(args: IServiceConfiguration['serviceArguments']): Partial<IServiceConfiguration['serviceArguments']> {
	const out: Loose = {};
	for (const [field, value] of Object.entries(args as unknown as Loose)) {
		if (Object.prototype.hasOwnProperty.call(LB_FIELD_CONFIRMATION, field) && LB_FIELD_CONFIRMATION[field].kind === 'identity') out[field] = value;
	}
	return out as Partial<IServiceConfiguration['serviceArguments']>;
}

/** What was sent: a whole rule (POST), or the listener tuple plus the changed members (PATCH). */
export type LBRuleSubmission = Pick<IServiceConfiguration, 'serviceArguments'> & Partial<Omit<IServiceConfiguration, 'serviceArguments'>>;

/**
 * The submitted rule is listed AND reads back with the values that were sent.
 *
 * `submitted` must be the body as it went on the wire (`buildLBCreateBody`),
 * not the form's state: the serializer drops fields, and a dropped field was
 * never asked for. For a merge-patch it is the rule's identity plus the
 * patched members, with `write: 'patch'`.
 *
 * A list the body does not carry (`endpoints`, `allowedSources`,
 * `secondaryIPs` left undefined) was not written and is not compared.
 */
export const lbRuleApplied =
	(submitted: LBRuleSubmission, options: {write?: 'post' | 'patch'} = {}) =>
	(rows: IServiceConfiguration[]): boolean => {
		const want = submitted.serviceArguments as unknown as Loose;
		const write = options.write ?? 'post';
		return rows.some(row => {
			const got = row.serviceArguments as unknown as Loose;
			if (!sameRule(want, got)) return false;
			if (!sameArguments(want, got, write)) return false;
			if (submitted.endpoints !== undefined && !sameEndpoints(submitted.endpoints as unknown as Loose[], row.endpoints as unknown as Loose[] | null)) return false;
			if (submitted.allowedSources !== undefined && !sameSources(submitted.allowedSources as unknown as Loose[], row.allowedSources as unknown as Loose[] | null)) return false;
			// Secondary addresses exist on SCTP rules only; on any other
			// protocol the gateway drops the list without storing it.
			if (submitted.secondaryIPs !== undefined && text(want.protocol).toLowerCase() === 'sctp'
				&& !sameSecondaryIPs(submitted.secondaryIPs as unknown as Loose[], row.secondaryIPs as unknown as Loose[] | null)) return false;
			return true;
		});
	};
