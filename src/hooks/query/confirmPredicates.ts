//---------------------------------------------------------
// confirm predicates ("did my write land?") per endpoint family.
//
// Two opposite mistakes are possible here and both are silent:
//
//   too LOOSE  → a sibling row satisfies the predicate and a write that never
//                landed is reported as confirmed. That is the false success
// exists to remove, reintroduced one layer down.
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

/**
 * A patch landed on an API key: every field the operator actually CHANGED now
 * reads back that way (Stage 4.1).
 *
 * ⚠️⚠️ THE CANONICALIZATION IS THE WHOLE POINT HERE, and it is the "too tight"
 * failure this file's header warns about, in its sharpest form. `ApiKeySummary`
 * says outright that "optional zero metadata can be absent" — so setting a
 * rate field to 0, which is an explicit and meaningful limit on this endpoint,
 * can read back as a MISSING FIELD. A predicate comparing `row.rate_limit_rps
 * === 0` would therefore never confirm the one edit most likely to be made
 * (lifting a limit), and the operator would be told a completed change had not
 * landed. Absent and 0 are compared as equal for exactly that reason.
 *
 * ⚠️ `allowed_models: []` can likewise come back as `null`, and `enabled` is
 * the only field guaranteed to serialize.
 *
 * ⭐ Only the fields the patch NAMED are compared — the rest were explicitly
 * left unchanged, so comparing them would test someone else's state.
 */
export const apiKeyPatchApplied =
	(keyId: string, patch: {allowed_models?: string[]; enabled?: boolean; rate_limit_rps?: number; burst_size?: number; tokens_per_min?: number}) =>
	(rows: {key_id?: string; allowed_models?: string[] | null; enabled?: boolean; rate_limit_rps?: number | null; burst_size?: number | null; tokens_per_min?: number | null}[]): boolean => {
		const row = rows.find(r => r.key_id === keyId);
		if (!row) return false;

		const numericMatches = (asked: number | undefined, served: number | null | undefined): boolean =>
			asked === undefined || asked === (served ?? 0);

		if (!numericMatches(patch.rate_limit_rps, row.rate_limit_rps)) return false;
		if (!numericMatches(patch.burst_size, row.burst_size)) return false;
		if (!numericMatches(patch.tokens_per_min, row.tokens_per_min)) return false;

		if (patch.enabled !== undefined && patch.enabled !== (row.enabled !== false)) return false;

		if (patch.allowed_models !== undefined) {
			if (patch.allowed_models.join(',') !== (row.allowed_models ?? []).join(',')) return false;
		}

		return true;
	};

//---------------------------------------------------------
// Per-user rate limits (Stage 4.2)
//---------------------------------------------------------
// The list is already scoped to one tenant, so the user id is the whole
// identity within it. Both predicates are deliberately existence-only: the
// gateway omits zero-valued fields from its read-back (proven on the API-key
// path), so comparing VALUES here would make a landed write look absent
// exactly when the operator set a limit to zero-means-inherit.

/** The user now has an explicit entry. */
export const userRateLimitAppeared =
	(userId: string) =>
	(rows: {user_id?: string}[]): boolean =>
		rows.some(r => r.user_id === userId);

/**
 * The user's explicit entry is gone, so they have fallen back to the
 * configured defaults. Absence IS the confirmation here.
 */
export const userRateLimitGone =
	(userId: string) =>
	(rows: {user_id?: string}[]): boolean =>
		!rows.some(r => r.user_id === userId);

//---------------------------------------------------------
// Rate-limit defaults (Stage 4.2b)
//---------------------------------------------------------
// scope+service is the key: the global row and a rule row are different rows,
// and two rule rows differ only by service.

const sameDefaultsRow = (scope: string, ruleIdent: string | undefined) =>
	(row: {scope?: string; rule_ident?: string}): boolean =>
		row.scope === scope && (row.rule_ident ?? '') === (ruleIdent ?? '');

/**
 * A defaults row was written and now reads back as asked.
 *
 * ⚠️⚠️ ABSENT IS COMPARED EQUAL TO ZERO, and on this endpoint that is not a
 * tolerance but the contract: a zero field FALLS THROUGH, and the gateway
 * omits it from the read-back entirely. Verified live — after posting a row
 * with one positive field, the GET carried that field alone and none of the
 * other five. A predicate demanding `row.default_user_rps === 0` would
 * therefore never confirm any row, since a row with all six positive is
 * exactly the row the gateway refuses.
 *
 * ⭐ All six fields are compared, not just the changed one, because the POST
 * REPLACES the row: every field was asserted by this write, so every field is
 * evidence about whether it landed.
 */
export const rateLimitDefaultsApplied =
	(mod: {
		scope: string;
		rule_ident?: string;
		default_user_rps?: number;
		default_user_tpm?: number;
		default_tenant_rps?: number;
		default_tenant_tpm?: number;
		vip_shared_rps?: number;
		vip_shared_tpm?: number;
	}) =>
	(rows: {scope?: string; rule_ident?: string; default_user_rps?: number | null; default_user_tpm?: number | null; default_tenant_rps?: number | null; default_tenant_tpm?: number | null; vip_shared_rps?: number | null; vip_shared_tpm?: number | null}[]): boolean => {
		const row = rows.find(sameDefaultsRow(mod.scope, mod.rule_ident));
		if (!row) return false;
		const matches = (asked: number | undefined, served: number | null | undefined): boolean => (asked ?? 0) === (served ?? 0);
		return matches(mod.default_user_rps, row.default_user_rps)
			&& matches(mod.default_user_tpm, row.default_user_tpm)
			&& matches(mod.default_tenant_rps, row.default_tenant_rps)
			&& matches(mod.default_tenant_tpm, row.default_tenant_tpm)
			&& matches(mod.vip_shared_rps, row.vip_shared_rps)
			&& matches(mod.vip_shared_tpm, row.vip_shared_tpm);
	};

/**
 * The defaults row is gone, so the identities it governed now fall through to
 * the next ladder level. Absence IS the confirmation.
 */
export const rateLimitDefaultsGone =
	(scope: string, ruleIdent?: string) =>
	(rows: {scope?: string; rule_ident?: string}[]): boolean =>
		!rows.some(sameDefaultsRow(scope, ruleIdent));
