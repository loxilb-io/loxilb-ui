//---------------------------------------------------------
// A rule write is confirmed by value, not by the rule merely being listed.
// (npx vitest run src/hooks/query/lbRuleApplied.test.ts)
//
// Both directions are pinned, as in confirmPredicates.test.ts:
//   too LOOSE — the rule was already listed, so an update that never landed
//               is confirmed by the row it failed to change;
//   too TIGHT — the gateway's own shaping of a read-back (zeros left out,
//               `null` for an empty list, its own endpoint order, a default
//               spelled out) makes a landed write look missing.
//
// The served rows below are written the way the gateway serializes a rule.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {buildLBCreateBody} from 'connector/instance/load_balancer';
import {canonicalSourcePrefix, lbRuleApplied, lbRuleIdentityArguments, LBRuleSubmission} from 'hooks/query/lbRuleApplied';
import {IServiceConfiguration} from 'types/load_balancer';

const rule = (args: Record<string, unknown>, rest: Record<string, unknown> = {}): IServiceConfiguration =>
	({serviceArguments: {externalIP: '203.0.113.75', port: 8443, protocol: 'tcp', mode: 4, ...args}, endpoints: [], secondaryIPs: [], allowedSources: [], ...rest}) as unknown as IServiceConfiguration;

const ep = (endpointIP: string, targetPort: number, weight: number, more: Record<string, unknown> = {}) => ({endpointIP, targetPort, weight, ...more});

/** A fullproxy rule as the gateway returns it after the write below landed. */
const servedArgs = {
	id: '0b6c1f0e-1111-4222-8333-444455556666',
	adminStateUp: true,
	name: 'chat',
	sel: 2,
	inactiveTimeOut: 240,
	security: 1,
	host: 'api.example',
	path_prefix: '/v1/chat',
	path_match_mode: 'prefix',
	backend_protocol: 'http1',
	sockMapMode: 'off',
	api_key_auth: 'required',
	fc_mode: 'enforce',
	fc_max_outstanding: 8,
	max_stream_duration_sec: 300,
	backend_ca_cert_id: 'ca-1',
	backend_tls_server_name: 'backend.internal',
	mtls_backend: {verify_server_cert: true},
	alpn_protocols: null,
	tls_versions: null,
	fc_effective: {mode: 'enforce', max_outstanding: 8},
	backend_tls_effective: {status: 'applied', generation: 3},
};
const servedRule = rule(servedArgs, {
	endpoints: [ep('10.0.0.2', 8000, 1, {state: 'active', counter: '4:400', backup: false}), ep('10.0.0.1', 8000, 3, {state: 'active', counter: '0:0', backup: false})],
	secondaryIPs: null,
	allowedSources: null,
});

const sentArgs = {
	name: 'chat',
	sel: 2,
	inactiveTimeOut: 0,
	security: 1,
	host: 'api.example',
	path_prefix: '/v1/chat',
	path_match_mode: 'prefix',
	backend_protocol: 'http1',
	api_key_auth: 'required',
	fc_mode: 'enforce',
	fc_max_outstanding: 8,
	fc_max_queue_depth: 0,
	max_stream_duration_sec: 300,
	backend_ca_cert_id: 'ca-1',
	backend_tls_server_name: 'backend.internal',
	mtls_backend: {verify_server_cert: true},
	monitor: false,
	bgp: false,
};
const sent = (args: Record<string, unknown> = {}, rest: Record<string, unknown> = {}): LBRuleSubmission =>
	rule({...sentArgs, ...args}, {endpoints: [ep('10.0.0.1', 8000, 3), ep('10.0.0.2', 8000, 1)], ...rest});

describe('a landed rule write is confirmed despite how the gateway shapes its answer', () => {
	it('confirms the rule as served: zeros left out, null lists, its own endpoint order, a defaulted timeout', () => {
		expect(lbRuleApplied(sent())([servedRule])).toBe(true);
	});

	it('confirms a field left to its default whether the gateway spells the default or leaves it out', () => {
		const spelled = rule({...servedArgs, fc_adaptive: 'inherit', half_close_mode: 'inherit'}, {endpoints: servedRule.endpoints});
		expect(lbRuleApplied(sent({fc_adaptive: 'inherit', sockMapMode: 'off'}))([spelled])).toBe(true);
		expect(lbRuleApplied(sent({half_close_mode: 'inherit'}))([servedRule])).toBe(true);
	});

	it('does not hold a non-fullproxy rule to fields the gateway only returns on fullproxy', () => {
		const l4 = rule({mode: 0, sel: 0}, {endpoints: [ep('10.0.0.1', 8000, 1)]});
		expect(lbRuleApplied(rule({mode: 0, sel: 0, backend_protocol: 'http1'}, {endpoints: [ep('10.0.0.1', 8000, 1)]}))([l4])).toBe(true);
	});

	it('does not hold the gateway to fields it accepts and never returns', () => {
		const withWriteOnly = sent({privateIP: '10.9.9.9', oper: 1, vip_qos_policy_id: 'gold', mtls_frontend: undefined});
		expect(lbRuleApplied(withWriteOnly)([servedRule])).toBe(true);
	});

	describe('member timeouts, TLS hardening and the client CRL path', () => {
		const hardening = {
			timeoutMemberConnect: 800,
			timeoutMemberData: 30000,
			timeoutTcpInspect: 5000,
			alpn_protocols: ['h2', 'http/1.1'],
			tls_ciphers: 'TLS_AES_256_GCM_SHA384:ECDHE-RSA-AES256-GCM-SHA384',
			tls_versions: ['TLSv1.2', 'TLSv1.3'],
			hsts_max_age: 600,
			hsts_include_subdomains: true,
			hsts_preload: true,
		};
		const served = (args: Record<string, unknown>) => rule({...servedArgs, ...args}, {endpoints: servedRule.endpoints, secondaryIPs: null, allowedSources: null});

		it('confirms them when they read back as sent', () => {
			expect(lbRuleApplied(sent(hardening))([served(hardening)])).toBe(true);
		});

		it.each(Object.keys(hardening))('does not confirm %s against a rule that reads back without it', field => {
			const {[field]: _left, ...others} = hardening as Record<string, unknown>;
			expect(lbRuleApplied(sent(hardening))([served(others)])).toBe(false);
		});

		it('does not confirm a value that reads back changed', () => {
			expect(lbRuleApplied(sent(hardening))([served({...hardening, tls_versions: ['TLSv1.3']})])).toBe(false);
			expect(lbRuleApplied(sent(hardening))([served({...hardening, hsts_max_age: 300})])).toBe(false);
		});

		it('confirms zeros and empty lists against a rule that stores none of them', () => {
			const zeros = {timeoutMemberConnect: 0, alpn_protocols: [], tls_ciphers: '', tls_versions: [], hsts_max_age: 0, hsts_include_subdomains: false};
			expect(lbRuleApplied(sent(zeros))([servedRule])).toBe(true);
		});

		it('holds the client CRL path to what was sent', () => {
			const mtls = {client_cert_mode: 'require', client_ca_path: '/opt/loxilb/cert/ca.crt', client_crl_path: '/opt/loxilb/cert/ca.crl'};
			expect(lbRuleApplied(sent({mtls_frontend: mtls}))([served({mtls_frontend: mtls})])).toBe(true);
			expect(lbRuleApplied(sent({mtls_frontend: mtls}))([served({mtls_frontend: {...mtls, client_crl_path: undefined}})])).toBe(false);
		});
	});

	it('confirms source prefixes that read back as their network, in any order', () => {
		const served = rule(servedArgs, {endpoints: servedRule.endpoints, allowedSources: [{prefix: '192.0.2.0/24'}, {prefix: '10.1.2.0/24'}]});
		expect(lbRuleApplied(sent({}, {allowedSources: [{prefix: '10.1.2.3/24'}, {prefix: '192.0.2.0/24'}]}))([served])).toBe(true);
	});

	it('does not compare secondary addresses off SCTP, where the gateway drops them', () => {
		expect(lbRuleApplied(sent({}, {secondaryIPs: [{secondaryIP: '198.51.100.9'}]}))([servedRule])).toBe(true);
	});

	it('confirms a rule sent without a name against the row the gateway named', () => {
		expect(lbRuleApplied(sent({name: ''}))([servedRule])).toBe(true);
	});

	it('confirms the body the connector really sends for a typical form draft', () => {
		// The form holds scaffolding the serializer drops (blank admission
		// fields, a disabled mTLS block, read-only fields copied from a read).
		const draft = rule({...sentArgs, fc_max_queue_depth: '', mtls_frontend: {client_cert_mode: 'disabled'}, fc_effective: {mode: 'off'}, kvEngineType: ''},
			{endpoints: [ep('10.0.0.1', 8000, 3), ep('10.0.0.2', 8000, 1)]});
		expect(lbRuleApplied(buildLBCreateBody(draft, 'inference-gateway'))([servedRule])).toBe(true);
	});
});

describe('a rule that is listed but does not hold the submitted values is not confirmed', () => {
	it.each([
		['an admission limit', {fc_max_outstanding: 16}],
		['an admission mode', {fc_mode: 'observe'}],
		['a cleared admission limit', {fc_max_outstanding: 0}],
		['the stream duration', {max_stream_duration_sec: 900}],
		['a cleared stream duration', {max_stream_duration_sec: 0}],
		['the credential policy', {api_key_auth: 'jwt'}],
		['the JWT profile', {api_key_auth: 'jwt', jwt_auth_profile: 'keycloak'}],
		['the backend CA', {backend_ca_cert_id: 'ca-2'}],
		['a cleared backend CA', {backend_ca_cert_id: ''}],
		['the backend client certificate', {backend_client_cert_id: 'client-1'}],
		['the backend server name', {backend_tls_server_name: 'other.internal'}],
		['backend verification', {mtls_backend: {verify_server_cert: false}}],
		['the backend protocol', {backend_protocol: 'h2c'}],
		['the selector', {sel: 8}],
		['an explicit idle timeout', {inactiveTimeOut: 600}],
		['frontend mTLS', {mtls_frontend: {client_cert_mode: 'require', client_cn_pattern: '*.corp'}}],
	])('stale %s', (_what, change) => {
		expect(lbRuleApplied(sent(change))([servedRule])).toBe(false);
	});

	it('a stale endpoint set: one backend swapped', () => {
		expect(lbRuleApplied(sent({}, {endpoints: [ep('10.0.0.1', 8000, 3), ep('10.0.0.3', 8000, 1)]}))([servedRule])).toBe(false);
	});

	it('a stale endpoint set: a backend that should have been removed is still there', () => {
		expect(lbRuleApplied(sent({}, {endpoints: [ep('10.0.0.1', 8000, 3)]}))([servedRule])).toBe(false);
	});

	it('a stale endpoint port or weight', () => {
		expect(lbRuleApplied(sent({}, {endpoints: [ep('10.0.0.1', 9000, 3), ep('10.0.0.2', 8000, 1)]}))([servedRule])).toBe(false);
		expect(lbRuleApplied(sent({}, {endpoints: [ep('10.0.0.1', 8000, 5), ep('10.0.0.2', 8000, 1)]}))([servedRule])).toBe(false);
	});

	it('a stale endpoint role', () => {
		expect(lbRuleApplied(sent({}, {endpoints: [ep('10.0.0.1', 8000, 3, {ep_role: 1}), ep('10.0.0.2', 8000, 1)]}))([servedRule])).toBe(false);
	});

	it('stale source prefixes, including a different mask on the same address', () => {
		const served = rule(servedArgs, {endpoints: servedRule.endpoints, allowedSources: [{prefix: '10.1.2.0/24'}]});
		expect(lbRuleApplied(sent({}, {allowedSources: [{prefix: '10.1.2.0/25'}]}))([served])).toBe(false);
		expect(lbRuleApplied(sent({}, {allowedSources: []}))([served])).toBe(false);
		expect(lbRuleApplied(sent({}, {allowedSources: [{prefix: '10.1.2.0/24'}]}))([servedRule])).toBe(false);
	});

	it('a name the gateway did not take', () => {
		expect(lbRuleApplied(sent({name: 'chat-v2'}))([servedRule])).toBe(false);
	});
});

describe('a sibling rule never confirms the write', () => {
	const sibling = (args: Record<string, unknown>) => rule({...servedArgs, ...args}, {endpoints: servedRule.endpoints});

	it.each([
		['another host', {host: 'other.example'}],
		['another path', {path_prefix: '/v1/completions'}],
		['another model', {model_name: 'model-a'}],
		['another match mode', {path_match_mode: 'exact'}],
		['a port range', {portMax: 8450}],
	])('%s on the same VIP, port and protocol', (_what, difference) => {
		expect(lbRuleApplied(sent())([sibling(difference)])).toBe(false);
	});

	it('a rule with a host does not confirm a write that set none', () => {
		const hostless = sent({host: '', path_prefix: '', path_match_mode: 'disabled'});
		expect(lbRuleApplied(hostless)([servedRule])).toBe(false);
		expect(lbRuleApplied(hostless)([rule({...servedArgs, host: undefined, path_prefix: undefined, path_match_mode: undefined}, {endpoints: servedRule.endpoints})])).toBe(true);
	});

	it('finds its own row among siblings', () => {
		expect(lbRuleApplied(sent())([sibling({model_name: 'model-a'}), servedRule])).toBe(true);
	});
});

describe('a merge-patch is held to the members it carried', () => {
	const l4Args = {name: 'l4', mode: 0, sel: 0, inactiveTimeOut: 240, adminStateUp: true, connectionLimit: 100};
	const l4 = rule(l4Args, {endpoints: [ep('10.0.0.1', 80, 1)], allowedSources: null});
	const patched = (patch: Record<string, unknown>, rest: Record<string, unknown> = {}): LBRuleSubmission =>
		({serviceArguments: {...lbRuleIdentityArguments(l4.serviceArguments), ...patch}, ...rest}) as LBRuleSubmission;

	it('the identity taken from a read row is the tuple and discriminators only', () => {
		expect(lbRuleIdentityArguments(l4.serviceArguments)).toEqual({externalIP: '203.0.113.75', port: 8443, protocol: 'tcp', name: 'l4'});
	});

	it('confirms when the patched member reads back, without looking at lists it did not carry', () => {
		expect(lbRuleApplied(patched({connectionLimit: 100}), {write: 'patch'})([l4])).toBe(true);
	});

	it('does not confirm while the patched member still holds the old value', () => {
		expect(lbRuleApplied(patched({connectionLimit: 500}), {write: 'patch'})([l4])).toBe(false);
		expect(lbRuleApplied(patched({probeTimeout: 30}), {write: 'patch'})([l4])).toBe(false);
	});

	it('compares the admin state on a patch, where the gateway applies it; a rule taken down reads back without the field', () => {
		const down = rule({...l4Args, adminStateUp: undefined}, {endpoints: l4.endpoints});
		expect(lbRuleApplied(patched({adminStateUp: false}), {write: 'patch'})([l4])).toBe(false);
		expect(lbRuleApplied(patched({adminStateUp: false}), {write: 'patch'})([down])).toBe(true);
	});

	it('does not compare the admin state on a POST, which never stores it', () => {
		expect(lbRuleApplied(patched({adminStateUp: false}))([l4])).toBe(true);
	});

	it('compares a patched endpoint list as a set', () => {
		expect(lbRuleApplied(patched({}, {endpoints: [ep('10.0.0.1', 80, 1)]}), {write: 'patch'})([l4])).toBe(true);
		expect(lbRuleApplied(patched({}, {endpoints: [ep('10.0.0.9', 80, 1)]}), {write: 'patch'})([l4])).toBe(false);
	});
});

describe('source prefixes are compared as the network the gateway stores', () => {
	it.each([
		['10.1.2.3/24', '10.1.2.0/24'],
		['10.1.2.3/32', '10.1.2.3/32'],
		['10.1.2.3/0', '0.0.0.0/0'],
		['203.0.113.200/25', '203.0.113.128/25'],
		[' 10.0.0.0/8 ', '10.0.0.0/8'],
		['2001:DB8::/32', '2001:db8::/32'],
	])('%s → %s', (written, stored) => {
		expect(canonicalSourcePrefix(written)).toBe(stored);
	});
});
