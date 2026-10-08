// A target addressed by name in the URL path cannot be reached through the
// management backend when the name holds `/`, `\`, `?` or `#`: the backend
// answers 400 "Invalid gateway path" and forwards nothing. These pin that such
// a request is refused here, with the cause named, and that nothing is sent.
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import enJSON from 'locales/en.json';
import jaJSON from 'locales/ja.json';
import koJSON from 'locales/ko.json';
import {request_delete_apikey, request_delete_user_ratelimit, request_patch_apikey} from 'connector/instance/ai';
import {request_delete_jwtauthprofile} from 'connector/instance/ai_jwt';
import {request_delete_bgp_policy_definition, request_delete_defined_set} from 'connector/instance/bgp';
import {lookup_cert, request_delete_cert_pem, request_rotate_cert_pem} from 'connector/instance/cert';
import {
	request_delete_ipsec_ca_certificate,
	request_delete_ipsec_certificate,
	request_delete_ipsec_tunnel,
	request_ipsec_tunnel_action,
	request_update_ipsec_tunnel,
} from 'connector/instance/ipsec';
import {request_delete_lb_by_name} from 'connector/instance/load_balancer';
import {request_delete_mirror_by_ident} from 'connector/instance/mirror';
import {request_delete_qos_policy} from 'connector/instance/qos';
import {IInstance} from 'types/oam';
import {OpResult} from './opResult';
import {pathRefusal, UNSENDABLE_PATH_KEY, unsendableInPath} from './pathSegment';

const INST = {id: 7, name: 'gw'} as IInstance;

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})));
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('unsendableInPath', () => {
	it.each([['a/b'], ['a\\b'], ['a?b'], ['a#b'], ['/'], ['#']])('refuses %s', value => {
		expect(unsendableInPath(value)).toBe(true);
	});

	// Everything else the backend forwards once encoded: these are names that
	// exist on real gateways and must keep working.
	it.each([['plain'], ['with space'], ['dot.name'], ['a:b'], ['10.0.0.1:80:tcp'], ['[2001:db8::1]:80:tcp'], ['a%2Fb'], ['a&b=c'], ['한글'], ['a+b@c'], ['']])(
		'allows "%s"',
		value => {
			expect(unsendableInPath(value)).toBe(false);
		},
	);

	it('refuses when any one of several values is bad', () => {
		expect(unsendableInPath('tenant', 'user/1')).toBe(true);
		expect(unsendableInPath('tenant', 'user')).toBe(false);
	});

	it('a value that is not a string is not a name and is not judged', () => {
		expect(unsendableInPath(undefined, null, 5)).toBe(false);
	});
});

describe('pathRefusal', () => {
	it('is an input problem that was not sent and cannot be retried', () => {
		const res = pathRefusal('lb.delete');
		expect(res.status).toBe('invalid');
		expect(res.code).toBe('lb.delete.client_invalid_path');
		expect(res.localeKey).toBe(UNSENDABLE_PATH_KEY);
		expect(res.retryable).toBe(false);
		expect(res.httpStatus).toBeUndefined();
	});

	it.each([
		['en', enJSON],
		['ko', koJSON],
		['ja', jaJSON],
	])('%s.json carries the sentence', (_lang, catalogue) => {
		expect(catalogue).toHaveProperty([UNSENDABLE_PATH_KEY]);
		expect((catalogue as Record<string, string>)[UNSENDABLE_PATH_KEY]).toContain('/ \\ ? #');
	});
});

type Call = (name: string) => Promise<OpResult>;
const BY_NAME: [string, Call][] = [
	['IPsec tunnel update', n => request_update_ipsec_tunnel(INST, n, {} as never)],
	['IPsec tunnel action', n => request_ipsec_tunnel_action(INST, n, 'initiate' as never)],
	['IPsec tunnel delete', n => request_delete_ipsec_tunnel(INST, n)],
	['IPsec certificate delete', n => request_delete_ipsec_certificate(INST, n)],
	['IPsec CA certificate delete', n => request_delete_ipsec_ca_certificate(INST, n)],
	['certificate rotate', n => request_rotate_cert_pem(INST, n, {} as never)],
	['certificate delete', n => request_delete_cert_pem(INST, n)],
	['JWT auth profile delete', n => request_delete_jwtauthprofile(INST, n)],
	['load balancer delete by name', n => request_delete_lb_by_name(INST, n)],
	['API key delete', n => request_delete_apikey(INST, n)],
	['API key patch', n => request_patch_apikey(INST, n, {enabled: false} as never)],
	['user rate limit delete, bad tenant', n => request_delete_user_ratelimit(INST, n, 'user')],
	['user rate limit delete, bad user', n => request_delete_user_ratelimit(INST, 'tenant', n)],
	['BGP defined set delete', n => request_delete_defined_set(INST, 'prefix', n)],
	['BGP policy definition delete', n => request_delete_bgp_policy_definition(INST, n)],
	['QoS policy delete', n => request_delete_qos_policy(INST, n)],
	['mirror delete', n => request_delete_mirror_by_ident(INST, n)],
];

describe('a change addressed by a name the backend refuses', () => {
	it.each(BY_NAME)('%s: refused before sending', async (_what, call) => {
		for (const bad of ['a/b', 'a\\b', 'a?b', 'a#b']) {
			const res = await call(bad);
			expect(res.status).toBe('invalid');
			expect(res.code).toMatch(/\.client_invalid_path$/);
			expect(res.localeKey).toBe(UNSENDABLE_PATH_KEY);
		}
		expect(global.fetch as Mock).not.toHaveBeenCalled();
	});

	it.each(BY_NAME)('%s: an ordinary name is sent', async (_what, call) => {
		const res = await call('ordinary-name_1');
		expect(res.code).not.toMatch(/client_invalid_path/);
		expect(global.fetch as Mock).toHaveBeenCalledTimes(1);
	});
});

describe('a certificate lookup by such an ID', () => {
	it('is an error with the cause, never "absent", and nothing is sent', async () => {
		const result = await lookup_cert(INST, 'a/b');
		expect(result.kind).toBe('error');
		expect(result.kind === 'error' && result.result.localeKey).toBe(UNSENDABLE_PATH_KEY);
		expect(global.fetch as Mock).not.toHaveBeenCalled();
	});
});
