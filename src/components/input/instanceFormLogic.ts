//---------------------------------------------------------
// Pure validation logic of the instance (LoxiLB registration) form,
// extracted from InstanceInputForm so every rule is unit-testable
// without a DOM.
//
// An "instance" here is a *registration record*: OAM stores it in
// loxilb_instances and derives the API endpoint it proxies to as
//     {protocol}://{host}:{port}/netlox/{version}
// (loxilb-oam internal/services/loxilb_service.go). Two consequences
// drive the rules below:
//
//   1. Every field lands inside a URL. A host with a slash, a version
//      with '..', or a port with spaces produces a malformed — or
//      attacker-chosen — endpoint. So each field is validated against
//      the grammar of the URL component it becomes, not merely
//      "non-empty".
//   2. The derived endpoint carries a UNIQUE constraint in the OAM
//      schema, and the UI addresses an instance by NAME (?name=… →
//      useInstanceFromURL). Duplicates therefore have to be caught
//      here as well: a duplicate endpoint would surface as a raw SQL
//      error, and a duplicate name would make one of the two
//      instances unreachable in the UI (find() returns the first).
//
// The server re-validates all of this independently (OAM handlers) —
// these rules exist to fail fast and explain, never as the only gate.
//---------------------------------------------------------
import {IInstance, IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Field-level grammars
//---------------------------------------------------------

// Name is a URL query value (?name=…) and a react-query cache key.
// Keep it to an unambiguous, URL-safe token so no escaping is ever
// required and two names can never differ only by encoding.
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NAME_MAX = 63;

// A single DNS label, per RFC 1123: alphanumeric ends, hyphens inside.
const DNS_LABEL_RE = /^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

// Gateway API version — it becomes a path segment (/netlox/{version}).
// Strict on purpose: this is the field a traversal ('../../') would
// ride in on.
const VERSION_RE = /^v[0-9]{1,3}$/;

// OCI/Docker image reference WITHOUT a tag: optional registry
// (host[:port]) followed by lowercase path components.
const IMAGE_PATH_COMPONENT = '[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*';
const IMAGE_REGISTRY = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*(?::[0-9]{1,5})?';
const IMAGE_RE = new RegExp(`^(?:${IMAGE_REGISTRY}/)?${IMAGE_PATH_COMPONENT}(?:/${IMAGE_PATH_COMPONENT})*$`);
const IMAGE_MAX = 255;

// OCI tag grammar: first char alphanumeric or underscore, then up to
// 127 more of [A-Za-z0-9._-].
const TAG_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const DESCRIPTION_MAX = 1024;
const HOST_MAX = 253;

export const PROTOCOLS = ['http', 'https'] as const;
export type TProtocol = (typeof PROTOCOLS)[number];

//---------------------------------------------------------
// Primitive validators (exported for direct testing)
//---------------------------------------------------------

export function is_valid_ipv4(value: string): boolean {
	const parts = value.split('.');
	if (parts.length !== 4) return false;
	return parts.every(part => {
		if (!/^[0-9]{1,3}$/.test(part)) return false;
		// Reject '01' / '007': an octet with a leading zero is parsed as
		// octal by some resolvers, so the same text can mean two addresses.
		if (part.length > 1 && part.startsWith('0')) return false;
		return Number(part) <= 255;
	});
}

// Accepts the textual IPv6 forms that can appear in a URL authority,
// including a single '::' elision and a trailing IPv4 mapping.
export function is_valid_ipv6(value: string): boolean {
	if (value === '' || !value.includes(':')) return false;
	if (/[^0-9A-Fa-f:.]/.test(value)) return false;
	if ((value.match(/::/g) ?? []).length > 1) return false;

	// Split off a trailing dotted-quad (::ffff:192.0.2.1) and count it as
	// two groups.
	let head = value;
	let tail_groups = 0;
	const last_colon = value.lastIndexOf(':');
	const tail = value.slice(last_colon + 1);
	if (tail.includes('.')) {
		if (!is_valid_ipv4(tail)) return false;
		head = value.slice(0, last_colon);
		tail_groups = 2;
		if (head === '') return false;
	}

	const elided = head.includes('::');
	const [left, right = ''] = elided ? head.split('::') : [head];
	const split = (segment: string): string[] => (segment === '' ? [] : segment.split(':'));
	const left_parts = split(left);
	const right_parts = split(right);

	for (const group of [...left_parts, ...right_parts]) {
		if (!/^[0-9A-Fa-f]{1,4}$/.test(group)) return false;
	}
	const total = left_parts.length + right_parts.length + tail_groups;
	return elided ? total <= 7 : total === 8;
}

export function is_valid_hostname(value: string): boolean {
	if (value === '' || value.length > HOST_MAX) return false;
	// A trailing dot is legal DNS but breaks equality with the same name
	// written without it — reject so one host has one spelling.
	if (value.endsWith('.')) return false;
	const labels = value.split('.');
	if (!labels.every(label => DNS_LABEL_RE.test(label))) return false;
	// A multi-label name whose rightmost label is all digits cannot be a real
	// hostname (RFC 3696 §2) — in practice it is a mistyped IPv4 address
	// ('192.0.2.999'), which must not slip through as "valid hostname".
	if (labels.length > 1 && /^[0-9]+$/.test(labels[labels.length - 1])) return false;
	return true;
}

/**
 * Hosts are stored verbatim and interpolated into the endpoint URL's
 * authority, so an IPv6 literal MUST arrive bracketed ([2001:db8::1]) —
 * a bare one would make `https://2001:db8::1:8080/…` unparseable.
 */
export function is_valid_host(value: string): boolean {
	if (value.startsWith('[') && value.endsWith(']')) return is_valid_ipv6(value.slice(1, -1));
	return is_valid_ipv4(value) || is_valid_hostname(value);
}

export function is_valid_port(value: string): boolean {
	if (!/^[0-9]{1,5}$/.test(value)) return false;
	// '08091' and '8091' would be stored as different strings but reach
	// the same socket — reject the ambiguous spelling.
	if (value.length > 1 && value.startsWith('0')) return false;
	const port = Number(value);
	return port >= 1 && port <= 65535;
}

export function is_valid_protocol(value: string): value is TProtocol {
	return (PROTOCOLS as readonly string[]).includes(value);
}

/** Mirrors OAM's endpoint derivation exactly (loxilb_service.go). */
export function build_api_endpoint(form: Pick<IInstanceInput, 'protocol' | 'host' | 'port' | 'version'>): string {
	return `${form.protocol}://${form.host}:${form.port}/netlox/${form.version}`;
}

//---------------------------------------------------------
// Form validation
//---------------------------------------------------------

export type TInstanceField = keyof IInstanceInput;

export interface IInstanceFormErrors extends Partial<Record<TInstanceField, string>> {
	/** Cross-field error (endpoint collision) — has no single field to sit on. */
	form?: string;
}

/** What the form reports upward: the values plus their verdict. */
export type TInstanceFormData = IInstanceInput & {isValid: boolean; errors: IInstanceFormErrors};

export interface IInstanceValidationContext {
	/** Instances already registered, for the uniqueness checks. */
	existing?: IInstance[];
	/** Set when editing — that instance is excluded from uniqueness. */
	editing_id?: number;
}

const trim = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

function validate_name(raw: string): string | undefined {
	if (raw === '') return 'Required';
	if (raw.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`;
	if (!NAME_RE.test(raw)) return 'Name may contain letters, digits, dot, dash and underscore, and must start with a letter or digit.';
	return undefined;
}

function validate_host(raw: string): string | undefined {
	if (raw === '') return 'Required';
	if (raw.includes('://')) return 'Enter the host only — no scheme (http:// or https://).';
	if (raw.includes('/')) return 'Enter the host only — no path.';
	if (/\s/.test(raw)) return 'Host must not contain spaces.';
	// A bare IPv6 is the one plausible input that is a valid address yet an
	// invalid URL authority; say so instead of "invalid host".
	if (!raw.startsWith('[') && is_valid_ipv6(raw)) return 'Wrap an IPv6 address in brackets, e.g. [2001:db8::1].';
	if (/^[^[\]]+:[0-9]+$/.test(raw)) return 'Enter the host only — put the port in the Port field.';
	if (raw.length > HOST_MAX) return `Host must be at most ${HOST_MAX} characters.`;
	if (!is_valid_host(raw)) return 'Enter a valid hostname, IPv4 address, or bracketed IPv6 address.';
	return undefined;
}

function validate_port(raw: string): string | undefined {
	if (raw === '') return 'Required';
	if (!/^[0-9]+$/.test(raw)) return 'Port must be a number.';
	if (!is_valid_port(raw)) return 'Invalid port number.';
	return undefined;
}

function validate_version(raw: string): string | undefined {
	if (raw === '') return 'Required';
	if (!VERSION_RE.test(raw)) return "API version must look like 'v1'.";
	return undefined;
}

function validate_cimage(raw: string): string | undefined {
	if (raw === '') return 'Required';
	if (raw.length > IMAGE_MAX) return `Container image must be at most ${IMAGE_MAX} characters.`;
	if (/\s/.test(raw)) return 'Container image must not contain spaces.';
	// A tag pasted into the image field is the most common mistake, and the
	// generic grammar error would not explain it. Only the LAST path segment
	// can carry a tag — a colon in the first segment is a registry port.
	if (raw.split('/').pop()!.includes(':')) return 'Put the tag in the Tag field — the image must not include ":tag".';
	if (raw !== raw.toLowerCase()) return 'Container image must be lowercase.';
	if (!IMAGE_RE.test(raw)) return 'Enter a valid image reference, e.g. ghcr.io/loxilb-io/loxilb.';
	return undefined;
}

function validate_ctag(raw: string): string | undefined {
	if (raw === '') return 'Required';
	if (!TAG_RE.test(raw)) return "Tag may contain letters, digits, dot, dash and underscore (e.g. 'latest').";
	return undefined;
}

function validate_description(raw: string): string | undefined {
	if (raw.length > DESCRIPTION_MAX) return `Description must be at most ${DESCRIPTION_MAX} characters.`;
	return undefined;
}

/**
 * Validates the whole form. Field errors are returned per field so the
 * inputs can render them inline; `form` carries the endpoint-collision
 * error, which belongs to no single field.
 *
 * Uniqueness is evaluated only against `existing` — the caller passes the
 * instance list it already has; an empty/omitted list simply skips those
 * two checks (the server still enforces them).
 */
export function validate_instance_form(form: Partial<IInstanceInput>, context: IInstanceValidationContext = {}): IInstanceFormErrors {
	const {existing = [], editing_id} = context;
	const values = {
		name: trim(form.name),
		host: trim(form.host),
		port: trim(form.port),
		protocol: trim(form.protocol),
		version: trim(form.version),
		cimage: trim(form.cimage),
		ctag: trim(form.ctag),
		description: trim(form.description),
	};

	const errors: IInstanceFormErrors = {};
	const set = (field: TInstanceField, message: string | undefined) => {
		if (message !== undefined) errors[field] = message;
	};

	set('name', validate_name(values.name));
	set('host', validate_host(values.host));
	set('port', validate_port(values.port));
	set('protocol', is_valid_protocol(values.protocol) ? undefined : 'Select http or https.');
	set('version', validate_version(values.version));
	set('cimage', validate_cimage(values.cimage));
	set('ctag', validate_ctag(values.ctag));
	set('description', validate_description(values.description));

	const others = existing.filter(item => item.id !== editing_id);

	// Name uniqueness is case-INsensitive: 'GW1' and 'gw1' would both
	// resolve through ?name= to whichever the list yields first.
	if (errors.name === undefined && others.some(item => trim(item.name).toLowerCase() === values.name.toLowerCase())) {
		errors.name = `An instance named '${values.name}' already exists.`;
	}

	// Endpoint collision — the OAM schema has UNIQUE(api_endpoint), so
	// without this the create fails as an opaque 500/409 from the driver.
	const endpoint_fields_valid = !errors.host && !errors.port && !errors.protocol && !errors.version;
	if (endpoint_fields_valid) {
		const endpoint = build_api_endpoint(values as Pick<IInstanceInput, 'protocol' | 'host' | 'port' | 'version'>);
		const clash = others.find(item => {
			const existing_endpoint = trim(item.api_endpoint) || build_api_endpoint(item);
			return existing_endpoint.toLowerCase() === endpoint.toLowerCase();
		});
		if (clash) errors.form = `Instance '${clash.name}' is already registered at ${endpoint}.`;
	}

	return errors;
}

export function has_errors(errors: IInstanceFormErrors): boolean {
	return Object.keys(errors).length > 0;
}

/** Convenience wrapper: true when the form may be submitted. */
export function is_instance_form_valid(form: Partial<IInstanceInput>, context: IInstanceValidationContext = {}): boolean {
	return !has_errors(validate_instance_form(form, context));
}

//---------------------------------------------------------
// Server error mapping
//---------------------------------------------------------

/**
 * Turns an OAM create/update failure into something an operator can act
 * on. The backend now answers 409 with a clear message for the two
 * conflict cases, but older builds surface the raw driver error — map
 * those too so the dialog never shows 'Error 1062'.
 */
export function describe_instance_error(raw: string | undefined): string {
	const message = trim(raw);
	if (message === '') return 'The server rejected the request.';
	const lower = message.toLowerCase();
	if (lower.includes('duplicate') && lower.includes('api_endpoint')) {
		return 'Another instance is already registered at this protocol/host/port/version.';
	}
	if (lower.includes('duplicate') && lower.includes('name')) return 'An instance with this name already exists.';
	if (lower.includes('forbidden')) return 'Your role does not permit managing instances.';
	return message;
}
