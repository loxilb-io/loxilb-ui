//---------------------------------------------------------
// UI-P6-3 — confirm predicates ("did my write land?") per endpoint family.
//
// Two opposite mistakes are possible here and both are silent:
//
//   too LOOSE  → a sibling row satisfies the predicate and a write that never
//                landed is reported as confirmed. That is the false success
//                UI-P6-3 exists to remove, reintroduced one layer down.
//   too TIGHT  → the gateway's own canonicalization (zero-valued fields come
//                back omitted, `[]` comes back `null`, optionals are defaulted
//                server-side, order is unstable) makes a landed write look
//                absent, and the operator is told "Submitted" about something
//                that is done (parent rule 6).
//
// The resolution is not one rule but two, because the two directions compare
// different things:
//
//   GONE (delete) — both sides are SERVER-shaped: the rows being deleted were
//   read from this same list. Canonicalization is therefore symmetric and the
//   full canonical identity is both safe and necessary. It is necessary
//   because the gateway legitimately serves rules that share VIP/port/protocol
//   and differ only by host, path, range or model — which is exactly why
//   canonicalLBRuleIdentity exists. Keying on VIP+port+protocol alone made a
//   completed delete look unconfirmed for as long as any peer survived
//   (caught by lb.spec.ts D-full-key).
//
//   APPEARED (create/update) — the submitted side is CLIENT-shaped, so the
//   full identity would compare fields the server is free to rewrite. Compare
//   only the fields the client actually SET: the key tuple, plus whichever
//   discriminators were specified. That is tight enough that a peer cannot
//   confirm someone else's write, and loose enough that a server default
//   cannot hide one.
//---------------------------------------------------------
import {IEndpointItem} from 'types/endpoint';
import {canonicalLBRuleIdentity} from 'types/lb_identity';
import {IServiceArguments, IServiceConfiguration} from 'types/load_balancer';

//---------------------------------------------------------
// Load balancer rules
//---------------------------------------------------------

/** Every rule the operator deleted is gone (server-shaped on both sides). */
export const lbRulesGone =
	(deleted: IServiceConfiguration[]) =>
	(rows: IServiceConfiguration[]): boolean => {
		const present = new Set(rows.map(canonicalLBRuleIdentity));
		return deleted.every(d => !present.has(canonicalLBRuleIdentity(d)));
	};

/** Discriminators, included only when the client actually set them. */
const LB_DISCRIMINATORS = ['name', 'host', 'path_prefix', 'model_name'] as const;

/** The rule the operator created/updated is present. */
export const lbRuleAppeared =
	(submitted: IServiceConfiguration) =>
	(rows: IServiceConfiguration[]): boolean => {
		const want = submitted.serviceArguments;
		const set = LB_DISCRIMINATORS.filter(f => {
			const v = want[f as keyof IServiceArguments];
			return typeof v === 'string' && v.length > 0;
		});
		return rows.some(r => {
			const got = r.serviceArguments;
			if ((got.externalIP ?? '') !== (want.externalIP ?? '')) return false;
			if (got.port !== want.port) return false;
			if ((got.protocol ?? '').toLowerCase() !== (want.protocol ?? '').toLowerCase()) return false;
			return set.every(f => got[f as keyof IServiceArguments] === want[f as keyof IServiceArguments]);
		});
	};

//---------------------------------------------------------
// Endpoints
//---------------------------------------------------------

/**
 * The same composite the endpoint table uses for row identity — a host can
 * carry several endpoints that differ by name, probe port or probe type.
 */
const epIdentity = (item: {name?: string; hostName?: string; probePort?: number; probeType?: string}): string =>
	[item.name ?? '', item.hostName ?? '', item.probePort ?? '', item.probeType ?? ''].join('|');

export const endpointsGone =
	(deleted: IEndpointItem[]) =>
	(rows: IEndpointItem[]): boolean => {
		const present = new Set(rows.map(epIdentity));
		return deleted.every(d => !present.has(epIdentity(d)));
	};

/**
 * `name` is optional on submission and assigned by the gateway when omitted,
 * so it joins the comparison only when the operator supplied it.
 */
export const endpointAppeared =
	(submitted: {hostName: string; name?: string}) =>
	(rows: IEndpointItem[]): boolean =>
		rows.some(r => (r.hostName ?? '') === submitted.hostName && (!submitted.name || r.name === submitted.name));

//---------------------------------------------------------
// AI API keys / tenant rate limits
//---------------------------------------------------------

/**
 * API keys are identified by the gateway-issued `key_id`, which the create
 * response carries — so confirmation here is exact, with no near-miss risk.
 */
export const apiKeyAppeared =
	(keyId: string) =>
	(rows: {key_id?: string}[]): boolean =>
		rows.some(r => r.key_id === keyId);

export const apiKeysGone =
	(deletedKeyIds: string[]) =>
	(rows: {key_id?: string}[]): boolean => {
		const present = new Set(rows.map(r => r.key_id));
		return deletedKeyIds.every(id => !present.has(id));
	};

/** One rate-limit row per tenant, so the tenant id is the whole identity. */
export const tenantRateLimitAppeared =
	(tenantId: string) =>
	(rows: {tenant_id?: string}[]): boolean =>
		rows.some(r => r.tenant_id === tenantId);
