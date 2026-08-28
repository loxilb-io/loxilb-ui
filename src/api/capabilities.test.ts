import {describe, expect, it} from 'vitest';
import securities from '../assets/json/securities.json';
import sels from '../assets/json/sels.json';
import {allowedEnumValues, detectFlavor, hasFeature, hasField, stripGatewayOnlyFields} from './capabilities';

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
		for (const field of ['model_name', 'api_key_auth', 'sse_mode', 'path_prefix', 'backend_protocol', 'mtls_frontend']) {
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

describe('stripGatewayOnlyFields', () => {
	// LX-EP-DEFAULTS. EndpointListForm.handleAdd MUST seed ep_role/nixl_port --
	// without them the P/D dropdown's announce path deletes the row the user
	// just added -- so the defaults exist for the form's own benefit and have no
	// business on the wire to a backend that declares neither field. Gating the
	// control was never enough; the field still shipped.
	it('drops the endpoint defaults the form seeds for itself', () => {
		const ep = {endpointIP: '10.0.0.1', targetPort: 8080, weight: 1, ep_role: 0, nixl_port: 0};
		const out = stripGatewayOnlyFields('loxilb', 'LoadbalanceEntry.endpoints[]', ep);
		expect(out).toEqual({endpointIP: '10.0.0.1', targetPort: 8080, weight: 1});
		expect('ep_role' in out, 'absent, not zero -- upstream would silently drop it and 422 once it validates').toBe(false);
	});

	it('leaves the gateway payload completely untouched', () => {
		const ep = {endpointIP: '10.0.0.1', ep_role: 1, nixl_port: 5555};
		expect(stripGatewayOnlyFields('inference-gateway', 'LoadbalanceEntry.endpoints[]', ep)).toBe(ep);
	});

	it('does not copy when there is nothing to strip', () => {
		// Identity, not just equality: the hot path must not allocate.
		const ep = {endpointIP: '10.0.0.1', targetPort: 8080};
		expect(stripGatewayOnlyFields('loxilb', 'LoadbalanceEntry.endpoints[]', ep)).toBe(ep);
	});

	it('does not mutate the object it was handed', () => {
		const ep = {endpointIP: '10.0.0.1', ep_role: 0};
		stripGatewayOnlyFields('loxilb', 'LoadbalanceEntry.endpoints[]', ep);
		expect(ep.ep_role, 'the form still needs its seeded default after the send').toBe(0);
	});

	it('strips per schema context, not by bare field name', () => {
		const sa = {sel: 'rr', model_name: 'llama', monitor: true};
		expect(stripGatewayOnlyFields('loxilb', 'LoadbalanceEntry.serviceArguments', sa)).toEqual({sel: 'rr', monitor: true});
		// Same object under a context that declares no gateway-only fields.
		expect(stripGatewayOnlyFields('loxilb', 'NoSuchSchema', sa)).toBe(sa);
	});

	it('strips the gateway-only keys of the top-level LB entry', () => {
		const body = {serviceArguments: {}, endpoints: [], secondaryVIPs: ['1.2.3.4'], offload_state: 'on'};
		const out = stripGatewayOnlyFields('loxilb', 'LoadbalanceEntry', body);
		expect(out).toEqual({serviceArguments: {}, endpoints: []});
	});
});
