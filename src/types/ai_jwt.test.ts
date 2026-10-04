//---------------------------------------------------------
// JWT auth profile contract logic (J1/J2)
//---------------------------------------------------------
// Every assertion here corresponds to a rule the gateway enforces, taken from
// the vendored spec text or from pkg/loxinet/rules_jwtprofile_test.go. They
// exist because each one is a way to build a form that compiles and then
// configures a gateway that refuses, or worse, silently admits.

import {describe, expect, it} from 'vitest';
import {IServiceConfiguration} from './load_balancer';
import {
	JWT_ALG_OPTIONS,
	JWT_PROFILE_NAME_MAX_BYTES,
	byteLength,
	isHttpUrl,
	normalizeJWTAuthProfile,
	rulesReferencingProfile,
	validateJWTAuthProfile,
} from './ai_jwt';

const base = {name: 'realm-a', issuer: 'https://idp.example.com/realms/a'};

describe('normalizeJWTAuthProfile — zero is never a meaningful value', () => {
	// Upstream is explicit: "zero or absent numeric fields select the
	// documented defaults; there is no field where zero is a meaningful
	// non-default configuration." So a form that sends 0 pins nothing — it
	// just makes the payload lie about what the operator chose.
	it('sends a zero numeric as ABSENT, never as 0', () => {
		const out = normalizeJWTAuthProfile({...base, leeway_sec: 0, refresh_sec: 0});
		expect(out).not.toHaveProperty('leeway_sec');
		expect(out).not.toHaveProperty('refresh_sec');
	});

	it('keeps a real numeric value', () => {
		const out = normalizeJWTAuthProfile({...base, leeway_sec: 60, refresh_sec: 900});
		expect(out.leeway_sec).toBe(60);
		expect(out.refresh_sec).toBe(900);
	});

	it('drops empty optional strings and trims the rest', () => {
		const out = normalizeJWTAuthProfile({...base, jwks_url: '  ', tenant_claim: ' tid ', models_claim: ''});
		expect(out).not.toHaveProperty('jwks_url');
		expect(out).not.toHaveProperty('models_claim');
		expect(out.tenant_claim).toBe('tid');
	});

	it('trims the identity fields, so a stray space cannot orphan a reference', () => {
		// A name with a trailing space would be created but no rule reference
		// could ever match it.
		const out = normalizeJWTAuthProfile({name: '  realm-a  ', issuer: ' https://idp.example.com '});
		expect(out.name).toBe('realm-a');
		expect(out.issuer).toBe('https://idp.example.com');
	});

	// ⚠️ The two exemptions. Empty here is a REAL, security-relevant setting,
	// so stripping it would silently change admission behaviour.
	it('never strips empty audiences — empty SKIPS the audience check', () => {
		const out = normalizeJWTAuthProfile({...base, audiences: []});
		expect(out.audiences).toEqual([]);
	});

	// ⚠️ The vendored contract declares `algs?: string[]` — optional, never
	// nullable — but the LIVE gateway answers `"algs": null` for a profile that
	// pins no algorithms (a nil Go slice, no omitempty). A guard written as
	// `!== undefined` lets that null through to `.length` and throws, so this
	// pins the runtime shape rather than the declared one.
	it('survives the null slice the gateway actually sends for algs', () => {
		const withNull = {...base, algs: null} as unknown as Parameters<typeof normalizeJWTAuthProfile>[0];
		expect(() => normalizeJWTAuthProfile(withNull)).not.toThrow();
	});

	it('never strips empty default_tenant — empty DENIES unattributable tokens', () => {
		const out = normalizeJWTAuthProfile({...base, default_tenant: ''});
		expect(out).toHaveProperty('default_tenant');
		expect(out.default_tenant).toBe('');
	});

	// An empty accept-list would read as "accept nothing"; upstream reads it
	// as "use the default RS256+ES256 pair", so absent is the honest encoding.
	it('drops an empty algs list rather than sending an empty accept-list', () => {
		const out = normalizeJWTAuthProfile({...base, algs: []});
		expect(out).not.toHaveProperty('algs');
	});
});

describe('validateJWTAuthProfile', () => {
	it('accepts a minimal valid profile', () => {
		expect(validateJWTAuthProfile(base).isValid).toBe(true);
	});

	it('requires name and issuer', () => {
		const r = validateJWTAuthProfile({name: '', issuer: ''});
		expect(r.isValid).toBe(false);
		expect(r.errors.name).toBeDefined();
		expect(r.errors.issuer).toBeDefined();
	});

	// The cap is 63 BYTES, and it exists because the LB rule's reference field
	// is capped at 63 — upstream rejects a 64-byte name at profile create
	// precisely so an accepted name that no rule could reference cannot exist.
	it('caps the name at 63 bytes, counting bytes and not characters', () => {
		expect(validateJWTAuthProfile({...base, name: 'a'.repeat(63)}).isValid).toBe(true);
		expect(validateJWTAuthProfile({...base, name: 'a'.repeat(64)}).errors.name).toBeDefined();

		// 21 three-byte characters = 63 bytes: valid. 22 = 66 bytes: not.
		// A character-count check would wrongly accept both.
		expect(byteLength('한'.repeat(21))).toBe(JWT_PROFILE_NAME_MAX_BYTES);
		expect(validateJWTAuthProfile({...base, name: '한'.repeat(21)}).isValid).toBe(true);
		expect(validateJWTAuthProfile({...base, name: '한'.repeat(22)}).errors.name).toBeDefined();
	});

	it('requires issuer to be an http(s) URL, since it is also the discovery base', () => {
		expect(validateJWTAuthProfile({...base, issuer: 'idp.example.com'}).errors.issuer).toBeDefined();
		expect(validateJWTAuthProfile({...base, issuer: 'ftp://idp.example.com'}).errors.issuer).toBeDefined();
		expect(validateJWTAuthProfile({...base, issuer: 'http://idp.example.com'}).isValid).toBe(true);
	});

	it('rejects a jwks_url that is not http(s), but allows it to be absent', () => {
		expect(validateJWTAuthProfile({...base, jwks_url: 'not-a-url'}).errors.jwks_url).toBeDefined();
		expect(validateJWTAuthProfile({...base, jwks_url: ''}).isValid).toBe(true);
	});

	// alg=none and every HMAC family are rejected unconditionally upstream and
	// are NOT configurable, so they must be unreachable from the form.
	it('offers only RS/ES/PS algorithms and rejects the dangerous ones', () => {
		expect(JWT_ALG_OPTIONS).not.toContain('none');
		expect(JWT_ALG_OPTIONS.some(a => a.startsWith('HS'))).toBe(false);
		expect(validateJWTAuthProfile({...base, algs: ['none']}).errors.algs).toBeDefined();
		expect(validateJWTAuthProfile({...base, algs: ['HS256']}).errors.algs).toBeDefined();
		expect(validateJWTAuthProfile({...base, algs: ['RS256', 'PS512']}).isValid).toBe(true);
	});
});

describe('rulesReferencingProfile', () => {
	const rule = (name: string, api_key_auth?: string, jwt_auth_profile?: string, externalIP = '10.0.0.1', port = 8080) =>
		({serviceArguments: {name, api_key_auth, jwt_auth_profile, externalIP, port}, endpoints: [], secondaryIPs: [], allowedSources: []}) as unknown as IServiceConfiguration;

	it('names the rules whose bearer arm resolves against the profile', () => {
		const rules = [
			rule('svc-a', 'jwt', 'realm-a'),
			rule('svc-b', 'apikey-or-jwt', 'realm-a'),
			rule('svc-c', 'jwt', 'realm-b'),
			rule('svc-d', 'required'),
			rule('svc-e'),
		];
		expect(rulesReferencingProfile(rules, 'realm-a')).toEqual(['svc-a', 'svc-b']);
		expect(rulesReferencingProfile(rules, 'realm-b')).toEqual(['svc-c']);
		expect(rulesReferencingProfile(rules, 'unused')).toEqual([]);
	});

	// A non-JWT mode carrying a profile cannot exist — the gateway refuses that
	// pairing outright (ErrJwtProfileNotApplicable) — so counting it would
	// over-report and warn about a reference that does not block anything.
	it('ignores a profile name on a mode that cannot consult it', () => {
		expect(rulesReferencingProfile([rule('svc', 'required', 'realm-a')], 'realm-a')).toEqual([]);
		expect(rulesReferencingProfile([rule('svc', undefined, 'realm-a')], 'realm-a')).toEqual([]);
	});

	it('is empty for no data or an empty name rather than throwing', () => {
		expect(rulesReferencingProfile(undefined, 'realm-a')).toEqual([]);
		expect(rulesReferencingProfile([rule('svc', 'jwt', 'realm-a')], '')).toEqual([]);
	});

	// ⚠️ An LB rule's name is very often EMPTY — a live gateway carried four
	// unnamed rules out of five, and the rule table renders those as "–". The
	// refusal message is built from this list, so mapping straight to `name`
	// produced "referenced by 1 LB rule(s): ." and identified nothing.
	it('falls back to VIP:port for an unnamed rule instead of an empty label', () => {
		const rules = [rule('', 'jwt', 'realm-a', '10.10.10.99', 19443)];
		expect(rulesReferencingProfile(rules, 'realm-a')).toEqual(['10.10.10.99:19443']);
	});

	// VIP:port is not an arbitrary choice: it is how the GATEWAY names the rule
	// when it refuses the delete — its 409 result reads
	// "jwt auth profile realm-a is referenced by rule(s): 10.10.10.99:19443".
	// Matching that vocabulary means the pre-check and the server point at the
	// rule the same way.
	it('uses the gateway\'s own vocabulary so the two refusals agree', () => {
		const named = rule('svc-a', 'jwt', 'realm-a', '10.10.10.99', 19443);
		const unnamed = rule('   ', 'jwt', 'realm-a', '10.10.10.98', 443);
		expect(rulesReferencingProfile([named, unnamed], 'realm-a')).toEqual(['10.10.10.98:443', 'svc-a']);
	});

	it('degrades to a readable placeholder when even the VIP is missing', () => {
		expect(rulesReferencingProfile([rule('', 'jwt', 'realm-a', '')], 'realm-a')).toEqual(['(unnamed rule)']);
	});
});

describe('isHttpUrl', () => {
	it('accepts http and https only', () => {
		expect(isHttpUrl('https://a.example')).toBe(true);
		expect(isHttpUrl('http://a.example')).toBe(true);
		expect(isHttpUrl('file:///etc/passwd')).toBe(false);
		// The scheme allow-list exists for this case: issuer and JWKS URLs are
		// operator-supplied and end up rendered as links, so a script URL that
		// survived validation would be stored XSS. Asserting it is refused is
		// the point of the rule, which is why the lint rule is suppressed here
		// rather than the assertion dropped.
		// eslint-disable-next-line no-script-url
		expect(isHttpUrl('javascript:alert(1)')).toBe(false);
		expect(isHttpUrl('')).toBe(false);
	});
});
