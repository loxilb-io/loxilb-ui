//---------------------------------------------------------
// Backend TLS policy of a load-balancer rule.
//
// Each case is a decision the gateway makes in ValidateBackendTLS; the client
// side agrees with it so a request known to be refused is not sent, and one
// the gateway accepts is not held back.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {serializeAIConfiguration} from './ai_gateway';
import {IServiceConfiguration} from './load_balancer';
import {backendTlsApplies, backendTlsDeclared, backendTlsRequested, isCertId, serializeBackendTls, validateBackendTls} from './backend_tls';

const E2E = {mode: 4, security: 2};
const fields = (issues: ReturnType<typeof validateBackendTls>) => issues.map(issue => issue.field);

describe('backendTlsApplies', () => {
	it('is the re-encrypting leg only: fullproxy with e2ehttps', () => {
		expect(backendTlsApplies(E2E)).toBe(true);
		expect(backendTlsApplies({mode: 4, security: 1})).toBe(false);
		expect(backendTlsApplies({mode: 4, security: 0})).toBe(false);
		expect(backendTlsApplies({mode: 0, security: 2})).toBe(false);
		expect(backendTlsApplies({})).toBe(false);
	});
});

describe('backendTlsDeclared', () => {
	// A gateway from before the feature declares both IDs and refuses them.
	it('reads the server name as the marker, not the certificate IDs', () => {
		expect(backendTlsDeclared({backend_ca_cert_id: {type: 'string'}, backend_client_cert_id: {type: 'string'}})).toBe(false);
		expect(backendTlsDeclared({backend_tls_server_name: {type: 'string'}})).toBe(true);
		expect(backendTlsDeclared(undefined)).toBe(false);
	});
});

describe('isCertId', () => {
	it('accepts what the gateway accepts and nothing it would turn into a path', () => {
		expect(isCertId('backend-ca')).toBe(true);
		expect(isCertId('ca.prod_2026')).toBe(true);
		expect(isCertId('a'.repeat(63))).toBe(true);
		expect(isCertId('a'.repeat(64))).toBe(false);
		expect(isCertId('é'.repeat(32))).toBe(false); // 64 bytes in 32 characters
		expect(isCertId('a/b')).toBe(false);
		expect(isCertId('a\\b')).toBe(false);
		expect(isCertId('a..b')).toBe(false);
		expect(isCertId('.')).toBe(false);
		expect(isCertId('   ')).toBe(false);
	});
});

describe('validateBackendTls', () => {
	it('has nothing to say about a rule that asks for nothing, on any mode', () => {
		expect(validateBackendTls({mode: 0})).toEqual([]);
		expect(validateBackendTls({...E2E, mtls_backend: {verify_server_cert: false}, backend_ca_cert_id: '  '})).toEqual([]);
	});

	// Off the leg the fields are disabled and dropped from the request, so a
	// leftover — even an invalid one — must not block the draft.
	it('does not judge a leftover off the re-encrypting leg, which is never sent', () => {
		const leftover = {mtls_backend: {verify_server_cert: true}, backend_client_cert_id: 'a/b', backend_tls_server_name: '10.0.0.1'};
		expect(validateBackendTls({mode: 4, security: 1, ...leftover})).toEqual([]);
		expect(validateBackendTls({mode: 0, security: 2, ...leftover})).toEqual([]);
		expect(serializeBackendTls({mode: 4, security: 1, ...leftover})).toEqual({mode: 4, security: 1});
	});

	it('needs a CA for verification: there is no default trust store', () => {
		expect(fields(validateBackendTls({...E2E, mtls_backend: {verify_server_cert: true}}))).toEqual(['backend_ca_cert_id']);
		expect(validateBackendTls({...E2E, mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: 'backend-ca'})).toEqual([]);
	});

	it('refuses a CA that nothing verifies against', () => {
		expect(fields(validateBackendTls({...E2E, backend_ca_cert_id: 'backend-ca'}))).toEqual(['backend_ca_cert_id']);
	});

	it('takes a client certificate and a server name without verification', () => {
		expect(validateBackendTls({...E2E, backend_client_cert_id: 'backend-client', backend_tls_server_name: 'api.internal'})).toEqual([]);
	});

	it('refuses an ID that is not a certificate ID', () => {
		expect(fields(validateBackendTls({...E2E, mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: '../etc'}))).toEqual(['backend_ca_cert_id']);
		expect(fields(validateBackendTls({...E2E, backend_client_cert_id: 'a/b'}))).toEqual(['backend_client_cert_id']);
	});

	it('refuses a server name that is an address or not a DNS host name', () => {
		for (const name of ['10.0.0.1', '2001:db8::1', 'bad_name.internal', '-lead.internal', 'trail-.internal', 'double..dot', 'a'.repeat(64) + '.internal', ('a'.repeat(60) + '.').repeat(5)]) {
			expect(fields(validateBackendTls({...E2E, backend_tls_server_name: name})), name).toEqual(['backend_tls_server_name']);
		}
		for (const name of ['api.internal', 'API-1.example.com', 'localhost', '1host.example']) {
			expect(validateBackendTls({...E2E, backend_tls_server_name: name}), name).toEqual([]);
		}
	});
});

describe('backendTlsRequested', () => {
	it('is false for blanks and an off flag', () => {
		expect(backendTlsRequested({mtls_backend: {verify_server_cert: false}, backend_tls_server_name: ' '})).toBe(false);
		expect(backendTlsRequested({backend_client_cert_id: 'c'})).toBe(true);
	});
});

describe('serializeBackendTls', () => {
	it('sends a full request trimmed, as asked', () => {
		expect(serializeBackendTls({...E2E, mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: ' backend-ca ', backend_client_cert_id: 'backend-client', backend_tls_server_name: 'api.internal'})).toEqual({
			...E2E,
			mtls_backend: {verify_server_cert: true},
			backend_ca_cert_id: 'backend-ca',
			backend_client_cert_id: 'backend-client',
			backend_tls_server_name: 'api.internal',
		});
	});

	it('sends a rule that asks for nothing as one: no blank member, no off flag', () => {
		expect(serializeBackendTls({...E2E, mtls_backend: {verify_server_cert: false}, backend_ca_cert_id: '', backend_client_cert_id: '  ', backend_tls_server_name: ''})).toEqual(E2E);
	});

	it('drops a request left over from an earlier mode or security choice', () => {
		const draft = {mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: 'backend-ca', backend_client_cert_id: 'backend-client', backend_tls_server_name: 'api.internal'};
		expect(serializeBackendTls({mode: 4, security: 1, ...draft})).toEqual({mode: 4, security: 1});
		expect(serializeBackendTls({mode: 0, security: 2, ...draft})).toEqual({mode: 0, security: 2});
	});

	it('leaves the retired members of mtls_backend as they were read', () => {
		const read = {...E2E, mtls_backend: {verify_server_cert: false, client_cert_path: '/old/path'} as {verify_server_cert?: boolean}};
		expect(serializeBackendTls(read).mtls_backend).toEqual({client_cert_path: '/old/path'});
	});

	it('does not change the object it was given', () => {
		const args = {mode: 0, backend_ca_cert_id: 'x', mtls_backend: {verify_server_cert: true}};
		serializeBackendTls(args);
		expect(args).toEqual({mode: 0, backend_ca_cert_id: 'x', mtls_backend: {verify_server_cert: true}});
	});
});

// The rule serializer has two exits (fullproxy and not); the request must be
// shaped on both, or a leftover travels on the one that was missed.
describe('the wire body of a rule', () => {
	const rule = (over: Record<string, unknown>): IServiceConfiguration =>
		({serviceArguments: {name: 'r', externalIP: '192.0.2.10', port: 8443, protocol: 'tcp', inactiveTimeOut: 0, ...over}, endpoints: [{endpointIP: '192.0.2.20', targetPort: 8443, weight: 1}]}) as IServiceConfiguration;
	const request = {mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: ' backend-ca ', backend_client_cert_id: '', backend_tls_server_name: 'api.internal'};

	it('carries the request on the re-encrypting leg', () => {
		const sent = serializeAIConfiguration(rule({mode: 4, security: 2, ...request})).serviceArguments;
		expect(sent).toMatchObject({mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: 'backend-ca', backend_tls_server_name: 'api.internal'});
		expect(sent).not.toHaveProperty('backend_client_cert_id');
	});

	it('carries none of it on a fullproxy rule without e2ehttps, nor off fullproxy', () => {
		for (const leg of [{mode: 4, security: 1}, {mode: 0, security: 2}]) {
			const sent = serializeAIConfiguration(rule({...leg, ...request})).serviceArguments;
			for (const field of ['mtls_backend', 'backend_ca_cert_id', 'backend_client_cert_id', 'backend_tls_server_name']) expect(sent, JSON.stringify(leg)).not.toHaveProperty(field);
		}
	});
});
