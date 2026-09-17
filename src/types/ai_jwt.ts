//---------------------------------------------------------
// AI Gateway JWT auth profiles (/config/ai/jwtauthprofile)
//
// Derived from the vendored gateway swagger (src/api/gen/gateway.ts) so the
// shape cannot drift from the live API contract — same discipline as types/ai.ts.
//---------------------------------------------------------
import type {GwSchema} from 'api';
import {IServiceArguments, IServiceConfiguration, requiresJwtProfile} from './load_balancer';

// GET list element / POST body. POST is create-OR-REPLACE and there is no
// PATCH, so an edit must send the whole entry: a partial send drops fields.
export type IJWTAuthProfileEntry = GwSchema<'JWTAuthProfileEntry'>;

export type JWTModelAuthz = NonNullable<IJWTAuthProfileEntry['model_authz']>;

//---------------------------------------------------------
// The signature-algorithm accept-list
//---------------------------------------------------------
// Upstream rejects `alg=none` and every HMAC algorithm unconditionally, and
// they are not configurable. Offering a free-text field would let an operator
// type a value the gateway can only refuse, so the picker enumerates exactly
// the three configurable families instead.
export const JWT_ALG_OPTIONS: readonly string[] = [
	'RS256', 'RS384', 'RS512',
	'ES256', 'ES384', 'ES512',
	'PS256', 'PS384', 'PS512',
];

// What the gateway applies when the field is absent. Held here so the form can
// show them as placeholders — per the zero-is-never-meaningful rule below, a
// default must never be materialized into the payload as a literal value.
export const JWT_PROFILE_DEFAULTS = {
	algs: ['RS256', 'ES256'] as readonly string[],
	leeway_sec: 30,
	refresh_sec: 3600,
	tenant_claim: 'tenant_id',
	user_claim: 'sub',
	roles_claim: 'realm_access.roles',
	model_role_prefix: 'model:',
	username_claim: 'preferred_username',
	model_authz: 'claims-required' as JWTModelAuthz,
} as const;

// The rule's jwt_auth_profile reference caps at 63 bytes, and the gateway
// rejects a 64-byte name at PROFILE CREATE precisely so an accepted name that
// no rule could reference cannot exist. Bytes, not characters: a non-ASCII
// name is shorter than it looks.
export const JWT_PROFILE_NAME_MAX_BYTES = 63;

export function byteLength(value: string): number {
	return new TextEncoder().encode(value).length;
}

//---------------------------------------------------------
// Draft normalization
//---------------------------------------------------------
// ⚠️ Zero is never a meaningful value on this entry. Upstream states it
// plainly: "zero or absent numeric fields select the documented defaults;
// there is no field where zero is a meaningful non-default configuration."
// So "leave at default" must go on the wire as an ABSENT field, never as 0 —
// and a form that round-trips a stored default back as a literal 0 would
// quietly pin a value the operator never chose.
//
// Two string fields are the opposite of innocuous when empty and are NOT
// stripped, because empty is a real, security-relevant configuration:
//   - empty `audiences` SKIPS the audience check entirely;
//   - empty `default_tenant` DENIES (401) tokens whose tenant claim is absent.
// Stripping either would silently change admission, so they are preserved
// exactly as the operator left them and labelled at the form.

const OPTIONAL_STRING_FIELDS = [
	'jwks_url', 'tenant_claim', 'user_claim', 'models_claim',
	'roles_claim', 'model_role_prefix', 'username_claim',
] as const;

const OPTIONAL_NUMBER_FIELDS = ['leeway_sec', 'refresh_sec'] as const;

/**
 * Turn a form draft into the payload the gateway should receive.
 *
 * Absent means "use the documented default". An empty optional string and a
 * zero number both mean the operator did not choose, so both become absent.
 * `audiences` and `default_tenant` are deliberately exempt — see above.
 */
export function normalizeJWTAuthProfile(draft: IJWTAuthProfileEntry): IJWTAuthProfileEntry {
	const out: IJWTAuthProfileEntry = {...draft};

	// Trim identity fields: a trailing space in a name would create a profile
	// no rule reference could match.
	out.name = (out.name ?? '').trim();
	out.issuer = (out.issuer ?? '').trim();

	for (const f of OPTIONAL_STRING_FIELDS) {
		const v = out[f];
		if (v === undefined || v.trim() === '') delete out[f];
		else out[f] = v.trim();
	}

	for (const f of OPTIONAL_NUMBER_FIELDS) {
		const v = out[f];
		// 0 selects the default upstream, so send nothing rather than pinning
		// a value the operator did not pick. A negative is never valid either.
		if (v === undefined || !Number.isFinite(v) || v <= 0) delete out[f];
	}

	// An empty algs list means "use the default pair", not "accept nothing".
	//
	// ⚠️ The guard is truthiness, not `!== undefined`. The vendored contract
	// declares `algs?: string[]` — optional, never nullable — but the live
	// gateway answers `"algs": null` for a profile that pins no algorithms (a
	// nil Go slice marshals to null, and the field carries no omitempty). A
	// `!== undefined` guard lets that null reach `.length` and throws. Every
	// slice-valued field on this entry can arrive the same way, `audiences`
	// included, so nothing here may trust the declared type to exclude null.
	if (out.algs !== undefined && out.algs !== null && out.algs.length === 0) delete out.algs;

	// Booleans default false; sending them explicitly is harmless and keeps a
	// replace faithful, so they are left as-is.
	return out;
}

//---------------------------------------------------------
// Validation
//---------------------------------------------------------

export interface IJWTProfileValidation {
	isValid: boolean;
	// Field-keyed messages; locale keys, resolved by the caller.
	errors: Partial<Record<keyof IJWTAuthProfileEntry, string>>;
}

/** `issuer` must be an http(s) URL — it is also the OIDC discovery base. */
export function isHttpUrl(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	return url.protocol === 'http:' || url.protocol === 'https:';
}

export function validateJWTAuthProfile(draft: IJWTAuthProfileEntry): IJWTProfileValidation {
	const errors: IJWTProfileValidation['errors'] = {};
	const name = (draft.name ?? '').trim();
	const issuer = (draft.issuer ?? '').trim();

	if (name === '') errors.name = 'Name is required.';
	else if (byteLength(name) > JWT_PROFILE_NAME_MAX_BYTES) {
		errors.name = 'Name must be at most 63 bytes — an LB rule reference cannot be longer.';
	}

	if (issuer === '') errors.issuer = 'Issuer is required.';
	else if (!isHttpUrl(issuer)) errors.issuer = 'Issuer must be an http(s) URL.';

	const jwks = (draft.jwks_url ?? '').trim();
	if (jwks !== '' && !isHttpUrl(jwks)) errors.jwks_url = 'JWKS URL must be an http(s) URL.';

	const badAlgs = (draft.algs ?? []).filter(a => !JWT_ALG_OPTIONS.includes(a));
	if (badAlgs.length > 0) errors.algs = 'Only RS, ES and PS algorithms are configurable.';

	for (const f of OPTIONAL_NUMBER_FIELDS) {
		const v = draft[f];
		if (v !== undefined && Number.isFinite(v) && v < 0) {
			errors[f] = 'Must be zero or greater; zero selects the default.';
		}
	}

	return {isValid: Object.keys(errors).length === 0, errors};
}

//---------------------------------------------------------
// Which rules reference a profile
//---------------------------------------------------------
// Deleting a referenced profile is refused with 409. Surfacing that as a bare
// status code tells an operator nothing actionable — "detach it from every
// rule first" is only useful once they know WHICH rules. The reference is
// plain data on rules already loaded for the AI pages, so the answer is
// computed rather than guessed from the error.
//
// This is advisory, not authoritative: the gateway decides, and a rule created
// between this read and the delete still refuses. It is here to make the
// common case explanatory and to warn BEFORE the operator tries.

/**
 * How one referencing rule is named to the operator.
 *
 * ⚠️ A rule's `name` is frequently EMPTY — a live gateway was observed with
 * four of five rules carrying none, and the rule table renders those as "–".
 * Keying the refusal message on the name alone therefore produced "referenced
 * by 1 LB rule(s): ." — an empty identifier that names nothing.
 *
 * VIP:port is the fallback because it is how the GATEWAY itself identifies the
 * rule when it refuses: its 409 reads "referenced by rule(s): 10.10.10.99:19443".
 * Using the same vocabulary means the pre-check and the server's own refusal
 * point at the rule the same way, instead of the operator having to reconcile
 * a name with an address.
 */
export function describeReferencingRule(args: IServiceArguments): string {
	const name = (args.name ?? '').trim();
	if (name !== '') return name;
	const vip = (args.externalIP ?? '').trim();
	return vip === '' ? '(unnamed rule)' : `${vip}:${args.port}`;
}

/** Identifies the LB rules whose bearer arm resolves against `profileName`. */
export function rulesReferencingProfile(
	configurations: readonly IServiceConfiguration[] | undefined,
	profileName: string,
): string[] {
	if (!configurations || profileName === '') return [];
	return configurations
		// A reference only counts where the mode actually consults it. A stale
		// name on a non-JWT rule cannot exist (the gateway refuses that pairing
		// outright), so matching on the name alone would over-report.
		.filter(c => requiresJwtProfile(c.serviceArguments.api_key_auth) && c.serviceArguments.jwt_auth_profile === profileName)
		.map(c => describeReferencingRule(c.serviceArguments))
		.sort((a, b) => a.localeCompare(b));
}
