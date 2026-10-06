//---------------------------------------------------------
// Backend TLS on a load-balancer rule: whether the gateway verifies the
// endpoints it connects to, against which CA bundle, which client certificate
// it presents, and the name it sends as SNI.
//
// The rules here are the gateway's own (common/backend_tls.go,
// ValidateBackendTLS), kept in one place so the form, the client-side backstop
// and the wire body agree. The gateway stays the authority: it also checks
// that each ID names a certificate of the right usage, which only it can know.
//---------------------------------------------------------
import {IServiceArguments} from './load_balancer';

export interface BackendTlsIssue {
	field: 'backend_ca_cert_id' | 'backend_client_cert_id' | 'backend_tls_server_name';
	message: string;
}

/** The string members of the request; `mtls_backend.verify_server_cert` is the fourth. */
export const BACKEND_TLS_STRING_FIELDS = ['backend_ca_cert_id', 'backend_client_cert_id', 'backend_tls_server_name'] as const;

type BackendTlsArgs = Pick<IServiceArguments, 'mode' | 'security' | 'mtls_backend' | (typeof BACKEND_TLS_STRING_FIELDS)[number]>;

/**
 * A certificate ID as the gateway accepts one (ValidateCertID): it names a
 * directory, so at most 63 bytes, no path separator and no `..`. Nothing else
 * is refused, so nothing else is refused here.
 */
export function isCertId(id: string): boolean {
	if (id.trim() === '' || new TextEncoder().encode(id).length > 63) return false;
	return !/[/\\\0]/.test(id) && id !== '.' && !id.includes('..');
}
const DNS_LABEL_RE = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

const text = (value: string | undefined): string => (value ?? '').trim();

/** Backend TLS is a property of the re-encrypting leg: fullproxy (4) with e2ehttps (2). */
export function backendTlsApplies(args: Pick<IServiceArguments, 'mode' | 'security'>): boolean {
	return args.mode === 4 && args.security === 2;
}

/**
 * Whether THIS gateway takes a backend TLS request, read from the rule fields
 * of its /meta.
 *
 * ⚠️ `backend_tls_server_name` is the marker, not the certificate IDs. A
 * gateway from before the feature already declares both IDs and refuses a
 * nonempty one with 400; the server name arrived with the release that
 * honours all four.
 */
export function backendTlsDeclared(params: Record<string, unknown> | undefined): boolean {
	return params?.backend_tls_server_name !== undefined;
}

/** Whether the rule asks for anything beyond an unauthenticated TLS leg. */
export function backendTlsRequested(args: BackendTlsArgs): boolean {
	return Boolean(args.mtls_backend?.verify_server_cert) || BACKEND_TLS_STRING_FIELDS.some(field => text(args[field]) !== '');
}

function serverNameIssue(name: string): string | undefined {
	if (name.length > 253) return 'The backend TLS server name is longer than 253 characters.';
	if (IPV4_RE.test(name) || name.includes(':')) return 'The backend TLS server name must be a DNS name, not an address. Leave it empty to match the endpoint address.';
	if (!name.split('.').every(label => label.length <= 63 && DNS_LABEL_RE.test(label))) return 'The backend TLS server name is not a DNS host name.';
	return undefined;
}

/**
 * What the gateway would refuse of the request that will be sent, before it is
 * asked. Empty when nothing is requested.
 *
 * Off the re-encrypting leg there is nothing to judge: the form disables the
 * fields there and serializeBackendTls drops them, so a value left from an
 * earlier mode or security choice is not a request. Reporting it would block a
 * draft over fields the operator can no longer reach.
 */
export function validateBackendTls(args: BackendTlsArgs): BackendTlsIssue[] {
	if (!backendTlsApplies(args) || !backendTlsRequested(args)) return [];
	const issues: BackendTlsIssue[] = [];
	const verify = Boolean(args.mtls_backend?.verify_server_cert);
	const ca = text(args.backend_ca_cert_id);
	const client = text(args.backend_client_cert_id);
	const name = text(args.backend_tls_server_name);

	if (verify && ca === '') issues.push({field: 'backend_ca_cert_id', message: 'Backend verification needs a CA certificate ID: there is no default trust store.'});
	if (!verify && ca !== '') issues.push({field: 'backend_ca_cert_id', message: 'A backend CA certificate ID has no effect unless backend verification is on.'});
	if (ca !== '' && !isCertId(ca)) issues.push({field: 'backend_ca_cert_id', message: 'The backend CA certificate ID is not a valid certificate ID.'});
	if (client !== '' && !isCertId(client)) issues.push({field: 'backend_client_cert_id', message: 'The backend client certificate ID is not a valid certificate ID.'});
	const nameIssue = name === '' ? undefined : serverNameIssue(name);
	if (nameIssue) issues.push({field: 'backend_tls_server_name', message: nameIssue});
	return issues;
}

/**
 * The backend TLS part of the wire body.
 *
 * A blank string is "nothing asked" and is omitted, as is a verification flag
 * that is off: the gateway reads the request by value, and a rule that asks
 * for nothing is sent as one. Off the re-encrypting leg the four are dropped —
 * the form disables them there, so a value left from an earlier mode or
 * security choice in the same draft must not travel and be refused.
 *
 * The retired members of `mtls_backend` are left as they were read.
 */
export function serializeBackendTls<T extends BackendTlsArgs>(args: T): T {
	const result = {...args};
	const applies = backendTlsApplies(args);
	for (const field of BACKEND_TLS_STRING_FIELDS) {
		const value = text(args[field]);
		if (!applies || value === '') delete result[field];
		else result[field] = value;
	}
	if (args.mtls_backend !== undefined) {
		const {verify_server_cert, ...retired} = args.mtls_backend;
		const kept = applies && verify_server_cert ? {...retired, verify_server_cert: true} : retired;
		if (Object.keys(kept).length === 0) delete result.mtls_backend;
		else result.mtls_backend = kept;
	}
	return result;
}
