import {describe, expect, it} from 'vitest';
import {buildLBDeleteKey, buildLBDeletePath, canonicalLBRuleIdentity, lbRuleRowId} from './lb_identity';
import {IServiceConfiguration} from './load_balancer';

const rule = (overrides: Partial<IServiceConfiguration['serviceArguments']> = {}): IServiceConfiguration => ({
	serviceArguments: {
		name: '',
		externalIP: '192.0.2.10',
		inactiveTimeOut: 0,
		port: 8000,
		protocol: 'tcp',
		...overrides,
	},
	endpoints: [],
	secondaryIPs: [],
	allowedSources: [],
});

describe('canonical LB rule identity', () => {
	it('distinguishes model, host, path and range peers sharing VIP/port/protocol', () => {
		const base = rule();
		const peers = [
			rule({model_name: 'llama/3'}),
			rule({host: 'api.example.test'}),
			rule({host: 'api.example.test', path_prefix: '/v1/chat', path_match_mode: 'prefix'}),
			rule({portMax: 8001}),
		];
		for (const peer of peers) {
			expect(canonicalLBRuleIdentity(peer)).not.toBe(canonicalLBRuleIdentity(base));
			expect(lbRuleRowId(peer)).not.toBe(lbRuleRowId(base));
		}
	});
});

describe('full-key LB delete path', () => {
	it('builds all four route shapes and omits model_name only for model-less rules', () => {
		expect(buildLBDeletePath(buildLBDeleteKey(rule()))).toBe(
			'/config/loadbalancer/externalipaddress/192.0.2.10/port/8000/protocol/tcp',
		);
		expect(buildLBDeletePath(buildLBDeleteKey(rule({portMax: 8010, model_name: 'llama 3'})))).toBe(
			'/config/loadbalancer/externalipaddress/192.0.2.10/port/8000/portmax/8010/protocol/tcp?model_name=llama+3',
		);
		expect(buildLBDeletePath(buildLBDeleteKey(rule({host: 'api.example.test', model_name: 'm/1'})))).toBe(
			'/config/loadbalancer/hosturl/api.example.test/externalipaddress/192.0.2.10/port/8000/protocol/tcp?model_name=m%2F1',
		);
		expect(buildLBDeletePath(buildLBDeleteKey(rule({
			host: 'api.example.test',
			portMax: 8010,
			path_prefix: '/v1/chat?debug=true',
			path_match_mode: 'exact',
			model_name: 'llama/3',
		})))).toBe(
			'/config/loadbalancer/hosturl/api.example.test/externalipaddress/192.0.2.10/port/8000/portmax/8010/protocol/tcp?path_prefix=%2Fv1%2Fchat%3Fdebug%3Dtrue&path_match_mode=exact&model_name=llama%2F3',
		);
	});

	it('encodes bracketed IPv6 without losing its brackets or colons after decoding', () => {
		const path = buildLBDeletePath(buildLBDeleteKey(rule({externalIP: '[2001:db8::10]', model_name: 'm'})));
		expect(path).toContain('/externalipaddress/%5B2001%3Adb8%3A%3A10%5D/');
		expect(decodeURIComponent(path.split('/externalipaddress/')[1].split('/port/')[0])).toBe('[2001:db8::10]');
	});
});
