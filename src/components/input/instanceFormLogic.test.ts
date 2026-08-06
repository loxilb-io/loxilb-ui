//---------------------------------------------------------
// Instance-registration form validation.
//
// The stakes: every field is interpolated into the endpoint URL OAM
// proxies to, the derived endpoint is UNIQUE in the schema, and the UI
// addresses instances by name. So these tests push on the adversarial
// inputs (scheme in the host, ':tag' in the image, traversal in the
// version, case-only name collisions), not just the happy path.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {IInstance, IInstanceInput} from 'types/oam';
import {
	build_api_endpoint,
	describe_instance_error,
	is_valid_host,
	is_valid_ipv4,
	is_valid_ipv6,
	is_valid_port,
	is_valid_protocol,
	is_instance_form_valid,
	validate_instance_form,
} from './instanceFormLogic';

const VALID: IInstanceInput = {
	name: 'gw-1',
	cimage: 'ghcr.io/loxilb-io/loxilb',
	ctag: 'latest',
	host: '192.0.2.10',
	port: '8091',
	protocol: 'https',
	version: 'v1',
	description: 'primary gateway',
	is_active: true,
};

function instance(overrides: Partial<IInstance> = {}): IInstance {
	const base: IInstance = {
		id: 1,
		name: 'existing',
		host: '192.0.2.1',
		port: '8091',
		protocol: 'https',
		version: 'v1',
		cimage: 'ghcr.io/loxilb-io/loxilb',
		ctag: 'latest',
		description: '',
		is_active: true,
		created_at: '2026-01-01T00:00:00Z',
		api_endpoint: 'https://192.0.2.1:8091/netlox/v1',
	};
	return {...base, ...overrides};
}

const form = (overrides: Partial<IInstanceInput>) => ({...VALID, ...overrides});
const errorsOf = (overrides: Partial<IInstanceInput>, ctx = {}) => validate_instance_form(form(overrides), ctx);

//---------------------------------------------------------
describe('primitives', () => {
	it('accepts canonical IPv4 and rejects octal-ambiguous / out-of-range forms', () => {
		expect(is_valid_ipv4('192.0.2.10')).toBe(true);
		expect(is_valid_ipv4('0.0.0.0')).toBe(true);
		expect(is_valid_ipv4('255.255.255.255')).toBe(true);
		// '01' is octal to some resolvers — one address must have one spelling
		expect(is_valid_ipv4('192.0.2.01')).toBe(false);
		expect(is_valid_ipv4('256.0.0.1')).toBe(false);
		expect(is_valid_ipv4('192.0.2')).toBe(false);
		expect(is_valid_ipv4('192.0.2.10.1')).toBe(false);
		expect(is_valid_ipv4('192.0.2.-1')).toBe(false);
		expect(is_valid_ipv4(' 192.0.2.10')).toBe(false);
	});

	it('validates IPv6 including elision and v4 mapping', () => {
		expect(is_valid_ipv6('2001:db8:0:0:0:0:0:1')).toBe(true);
		expect(is_valid_ipv6('2001:db8::1')).toBe(true);
		expect(is_valid_ipv6('::1')).toBe(true);
		expect(is_valid_ipv6('::')).toBe(true);
		expect(is_valid_ipv6('::ffff:192.0.2.1')).toBe(true);
		expect(is_valid_ipv6('2001:db8::1::2')).toBe(false); // two elisions
		expect(is_valid_ipv6('2001:db8:0:0:0:0:1')).toBe(false); // 7 groups, no elision
		expect(is_valid_ipv6('2001:db8:0:0:0:0:0:0:1')).toBe(false); // 9 groups
		expect(is_valid_ipv6('2001:dbg::1')).toBe(false); // 'g' is not hex
		expect(is_valid_ipv6('192.0.2.1')).toBe(false);
	});

	it('accepts RFC1123 hostnames and rejects malformed labels', () => {
		expect(is_valid_host('gw1.example.com')).toBe(true);
		expect(is_valid_host('localhost')).toBe(true);
		expect(is_valid_host('a-b.c-d.example')).toBe(true);
		expect(is_valid_host('example.com.')).toBe(false); // trailing dot
		expect(is_valid_host('-bad.example.com')).toBe(false);
		expect(is_valid_host('bad-.example.com')).toBe(false);
		expect(is_valid_host('exa mple.com')).toBe(false);
		expect(is_valid_host('a'.repeat(64) + '.com')).toBe(false); // label > 63
		expect(is_valid_host('')).toBe(false);
	});

	it('does not let a mistyped IPv4 pass as a hostname (all-numeric TLD)', () => {
		expect(is_valid_host('192.0.2.999')).toBe(false);
		expect(is_valid_host('192.0.2.10.5')).toBe(false);
		expect(is_valid_host('10')).toBe(true); // single label — a legitimate short name
		expect(is_valid_host('gw1.example.com')).toBe(true);
	});

	it('requires IPv6 hosts to be bracketed (they land in a URL authority)', () => {
		expect(is_valid_host('[2001:db8::1]')).toBe(true);
		expect(is_valid_host('2001:db8::1')).toBe(false);
		expect(is_valid_host('[not:an:address]')).toBe(false);
	});

	it('accepts ports 1-65535 in canonical spelling only', () => {
		expect(is_valid_port('1')).toBe(true);
		expect(is_valid_port('8091')).toBe(true);
		expect(is_valid_port('65535')).toBe(true);
		expect(is_valid_port('0')).toBe(false);
		expect(is_valid_port('65536')).toBe(false);
		expect(is_valid_port('08091')).toBe(false); // same socket, different string
		expect(is_valid_port('80.5')).toBe(false);
		expect(is_valid_port('-1')).toBe(false);
		expect(is_valid_port('')).toBe(false);
	});

	it('accepts only http/https', () => {
		expect(is_valid_protocol('http')).toBe(true);
		expect(is_valid_protocol('https')).toBe(true);
		expect(is_valid_protocol('HTTPS')).toBe(false);
		expect(is_valid_protocol('ftp')).toBe(false);
		expect(is_valid_protocol('')).toBe(false);
	});

	it('derives the endpoint exactly as OAM does', () => {
		expect(build_api_endpoint(VALID)).toBe('https://192.0.2.10:8091/netlox/v1');
		expect(build_api_endpoint({protocol: 'http', host: '[2001:db8::1]', port: '80', version: 'v2'})).toBe('http://[2001:db8::1]:80/netlox/v2');
	});
});

//---------------------------------------------------------
describe('validate_instance_form — happy path', () => {
	it('accepts a well-formed registration', () => {
		expect(validate_instance_form(VALID)).toEqual({});
		expect(is_instance_form_valid(VALID)).toBe(true);
	});

	it('accepts a bracketed IPv6 host and a hostname', () => {
		expect(errorsOf({host: '[2001:db8::1]'})).toEqual({});
		expect(errorsOf({host: 'gw1.example.com'})).toEqual({});
	});

	it('tolerates surrounding whitespace on every field', () => {
		expect(errorsOf({name: '  gw-1  ', host: ' 192.0.2.10 ', port: ' 8091 ', version: ' v1 '})).toEqual({});
	});

	it('treats description as optional', () => {
		expect(errorsOf({description: ''})).toEqual({});
	});
});

//---------------------------------------------------------
describe('validate_instance_form — required fields', () => {
	it.each(['name', 'host', 'port', 'cimage', 'ctag', 'version'] as const)('flags empty %s as Required', field => {
		expect(errorsOf({[field]: ''})[field]).toBe('Required');
	});

	it('rejects a whitespace-only value the same as empty', () => {
		expect(errorsOf({name: '   '}).name).toBe('Required');
	});

	it('reports every invalid field at once, not just the first', () => {
		const errors = validate_instance_form({name: '', host: 'http://x', port: '0', protocol: 'ftp', version: 'x', cimage: '', ctag: ''});
		expect(Object.keys(errors).sort()).toEqual(['cimage', 'ctag', 'host', 'name', 'port', 'protocol', 'version']);
	});
});

//---------------------------------------------------------
describe('validate_instance_form — name', () => {
	it('rejects characters that would need URL escaping in ?name=', () => {
		for (const bad of ['gw 1', 'gw/1', 'gw?1', 'gw#1', 'gw&1', 'gw%1', 'gw=1', 'gw+1', '한글']) {
			expect(errorsOf({name: bad}).name, bad).toBeDefined();
		}
	});

	it('requires an alphanumeric first character', () => {
		expect(errorsOf({name: '-gw'}).name).toBeDefined();
		expect(errorsOf({name: '.gw'}).name).toBeDefined();
		expect(errorsOf({name: '_gw'}).name).toBeDefined();
		expect(errorsOf({name: '1gw'}).name).toBeUndefined();
	});

	it('caps the length at 63', () => {
		expect(errorsOf({name: 'a'.repeat(63)}).name).toBeUndefined();
		expect(errorsOf({name: 'a'.repeat(64)}).name).toContain('at most 63');
	});
});

//---------------------------------------------------------
describe('validate_instance_form — host', () => {
	it('explains a pasted URL instead of just "invalid"', () => {
		expect(errorsOf({host: 'https://192.0.2.10'}).host).toContain('no scheme');
		expect(errorsOf({host: '192.0.2.10/netlox'}).host).toContain('no path');
	});

	it('explains an embedded port', () => {
		expect(errorsOf({host: '192.0.2.10:8091'}).host).toContain('port in the Port field');
		expect(errorsOf({host: 'gw1.example.com:8091'}).host).toContain('port in the Port field');
	});

	it('explains an unbracketed IPv6 rather than calling it invalid', () => {
		expect(errorsOf({host: '2001:db8::1'}).host).toContain('brackets');
	});

	it('rejects garbage hosts', () => {
		expect(errorsOf({host: '192.0.2.999'}).host).toBeDefined();
		expect(errorsOf({host: 'gw_1.example.com'}).host).toBeDefined();
		expect(errorsOf({host: '[2001:db8::1'}).host).toBeDefined();
	});
});

//---------------------------------------------------------
describe('validate_instance_form — version, image, tag', () => {
	it("pins the version to a 'v<n>' path segment", () => {
		expect(errorsOf({version: 'v1'}).version).toBeUndefined();
		expect(errorsOf({version: 'v12'}).version).toBeUndefined();
		expect(errorsOf({version: '1'}).version).toBeDefined();
		expect(errorsOf({version: 'V1'}).version).toBeDefined();
		expect(errorsOf({version: 'v1/config'}).version).toBeDefined();
	});

	it('refuses path traversal in the version (it becomes a URL segment)', () => {
		expect(errorsOf({version: '../../config'}).version).toBeDefined();
		expect(errorsOf({version: 'v1/../..'}).version).toBeDefined();
	});

	it('accepts registry-qualified images and rejects an inline tag', () => {
		expect(errorsOf({cimage: 'loxilb'}).cimage).toBeUndefined();
		expect(errorsOf({cimage: 'loxilb-io/loxilb'}).cimage).toBeUndefined();
		expect(errorsOf({cimage: 'ghcr.io/loxilb-io/loxilb'}).cimage).toBeUndefined();
		expect(errorsOf({cimage: 'registry.local:5000/loxilb-io/loxilb'}).cimage).toBeUndefined();
		expect(errorsOf({cimage: 'ghcr.io/loxilb-io/loxilb:latest'}).cimage).toContain('tag in the Tag field');
	});

	it('rejects malformed images', () => {
		expect(errorsOf({cimage: 'ghcr.io/LoxiLB'}).cimage).toContain('lowercase');
		expect(errorsOf({cimage: 'ghcr.io//loxilb'}).cimage).toBeDefined();
		expect(errorsOf({cimage: 'ghcr.io/loxilb '}).cimage).toBeUndefined(); // trimmed
		expect(errorsOf({cimage: 'ghcr.io/lox ilb'}).cimage).toContain('spaces');
		expect(errorsOf({cimage: 'a'.repeat(256)}).cimage).toContain('at most 255');
	});

	it('applies the OCI tag grammar', () => {
		for (const good of ['latest', 'v0.9.7', 'u24', '2026-08-05', '_x']) {
			expect(errorsOf({ctag: good}).ctag, good).toBeUndefined();
		}
		for (const bad of ['-latest', '.latest', 'lat est', 'lat/est', 'a'.repeat(129)]) {
			expect(errorsOf({ctag: bad}).ctag, bad).toBeDefined();
		}
	});

	it('caps the description', () => {
		expect(errorsOf({description: 'x'.repeat(1024)}).description).toBeUndefined();
		expect(errorsOf({description: 'x'.repeat(1025)}).description).toContain('at most 1024');
	});
});

//---------------------------------------------------------
describe('validate_instance_form — uniqueness', () => {
	const existing = [instance({id: 1, name: 'gw-a', host: '192.0.2.1', api_endpoint: 'https://192.0.2.1:8091/netlox/v1'})];

	it('rejects a duplicate name case-insensitively (?name= resolves to one of them)', () => {
		expect(errorsOf({name: 'gw-a'}, {existing}).name).toContain('already exists');
		expect(errorsOf({name: 'GW-A'}, {existing}).name).toContain('already exists');
		expect(errorsOf({name: 'gw-b'}, {existing}).name).toBeUndefined();
	});

	it('rejects a duplicate endpoint before the UNIQUE constraint does', () => {
		const errors = errorsOf({name: 'gw-b', host: '192.0.2.1', port: '8091', protocol: 'https', version: 'v1'}, {existing});
		expect(errors.form).toContain('already registered');
		expect(errors.form).toContain('gw-a');
	});

	it('allows the same host on a different port/protocol/version', () => {
		expect(errorsOf({name: 'gw-b', host: '192.0.2.1', port: '8092'}, {existing}).form).toBeUndefined();
		expect(errorsOf({name: 'gw-b', host: '192.0.2.1', protocol: 'http'}, {existing}).form).toBeUndefined();
		expect(errorsOf({name: 'gw-b', host: '192.0.2.1', version: 'v2'}, {existing}).form).toBeUndefined();
	});

	it('excludes the edited instance from both checks (re-saving is not a conflict)', () => {
		const same = {name: 'gw-a', host: '192.0.2.1', port: '8091', protocol: 'https', version: 'v1'};
		expect(errorsOf(same, {existing, editing_id: 1})).toEqual({});
		expect(errorsOf(same, {existing})).not.toEqual({});
	});

	it('falls back to deriving the endpoint when the stored one is missing', () => {
		const legacy = [instance({id: 7, name: 'gw-legacy', host: '192.0.2.7', api_endpoint: ''})];
		expect(errorsOf({name: 'gw-b', host: '192.0.2.7'}, {existing: legacy}).form).toContain('gw-legacy');
	});

	it('skips the endpoint check while the endpoint fields are still invalid', () => {
		expect(errorsOf({host: '', name: 'gw-b'}, {existing}).form).toBeUndefined();
	});

	it('does no uniqueness check when no list is supplied', () => {
		expect(errorsOf({name: 'gw-a'})).toEqual({});
	});
});

//---------------------------------------------------------
describe('describe_instance_error', () => {
	it('translates the driver-level conflicts operators used to see raw', () => {
		expect(describe_instance_error("Error 1062 (23000): Duplicate entry 'https://x:80/netlox/v1' for key 'loxilb_instances.api_endpoint'")).toContain('already registered');
		expect(describe_instance_error("Duplicate entry 'gw-a' for key 'loxilb_instances.name'")).toContain('name already exists');
	});

	it('passes a clear server message through unchanged', () => {
		expect(describe_instance_error('port must be between 1 and 65535')).toBe('port must be between 1 and 65535');
	});

	it('explains an RBAC rejection', () => {
		expect(describe_instance_error('Forbidden: your role does not permit this operation')).toContain('does not permit');
	});

	it('never renders an empty error', () => {
		expect(describe_instance_error(undefined)).toBe('The server rejected the request.');
		expect(describe_instance_error('   ')).toBe('The server rejected the request.');
	});
});
