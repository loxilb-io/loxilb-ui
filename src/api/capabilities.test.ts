import {describe, expect, it} from 'vitest';
import securities from '../assets/json/securities.json';
import sels from '../assets/json/sels.json';
import {allowedEnumValues, detectFlavor, hasFeature, hasField} from './capabilities';

// The capability helpers are exercised against the REAL generated map
// (src/api/gen/loxilb-capability-map.json), not fixtures — these tests double
// as a sanity check that regeneration keeps the shapes the gating relies on.

describe('detectFlavor', () => {
	it('detects the gateway from its product id', () => {
		expect(detectFlavor({product: 'loxilb-inference-gateway'})).toBe('inference-gateway');
	});
	it('defaults to loxilb whenever product is absent or unknown', () => {
		// Live loxilb 0.9.8-dev payload (2026-08-13): no product field at all.
		expect(detectFlavor({})).toBe('loxilb');
		expect(detectFlavor(null)).toBe('loxilb');
		expect(detectFlavor({product: 'loxilb'})).toBe('loxilb');
		expect(detectFlavor({product: 'something-newer'})).toBe('loxilb');
	});
});

describe('hasFeature', () => {
	it('gives the gateway everything', () => {
		for (const f of ['ai', 'ipsec', 'sniCerts', 'ipfilter', 'securityrate', 'ipv6'] as const) {
			expect(hasFeature('inference-gateway', f)).toBe(true);
		}
	});
	it('hides the gateway-only families on loxilb', () => {
		for (const f of ['ai', 'ipsec', 'sniCerts', 'ipfilter', 'securityrate', 'ipv6', 'trace', 'l7policy'] as const) {
			expect(hasFeature('loxilb', f), f).toBe(false);
		}
	});
});

describe('hasField', () => {
	it('drops gateway-only LB write fields on loxilb (silent-drop class)', () => {
		for (const field of ['model_name', 'sse_mode', 'path_prefix', 'backend_protocol', 'mtls_frontend']) {
			expect(hasField('loxilb', 'LoadbalanceEntry.serviceArguments', field), field).toBe(false);
			expect(hasField('inference-gateway', 'LoadbalanceEntry.serviceArguments', field), field).toBe(true);
		}
		expect(hasField('loxilb', 'LoadbalanceEntry.endpoints[]', 'ep_role')).toBe(false);
	});
	it('keeps the shared fields everywhere', () => {
		for (const field of ['sel', 'security', 'mode', 'bgp', 'monitor']) {
			expect(hasField('loxilb', 'LoadbalanceEntry.serviceArguments', field), field).toBe(true);
		}
	});
});

describe('allowedEnumValues', () => {
	it('filters the 422 hard-break enum values on loxilb (verified live 2026-08-13)', () => {
		const selValues = sels.map(s => s.send_value);
		expect(allowedEnumValues('loxilb', 'LoadbalanceEntry.serviceArguments.sel', selValues)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(allowedEnumValues('inference-gateway', 'LoadbalanceEntry.serviceArguments.sel', selValues)).toEqual(selValues);

		const probeValues = ['tcp', 'udp', 'sctp', 'ping', 'http', 'https', 'none', 'tls-hello'];
		expect(allowedEnumValues('loxilb', 'EndPoint.probeType', probeValues)).not.toContain('tls-hello');
	});
	it('accepts every shipped security option on both flavors after the §3d fix', () => {
		const values = securities.map(s => s.send_value);
		expect(allowedEnumValues('loxilb', 'LoadbalanceEntry.serviceArguments.security', values)).toEqual(values);
	});
});
