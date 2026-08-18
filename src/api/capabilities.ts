//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import capabilityMap from './gen/loxilb-capability-map.json';

//---------------------------------------------------------
// Instance flavor
//---------------------------------------------------------
// The same UI manages both upstream loxilb and loxilb-inference-gateway
// instances on the shared /netlox/v1 surface. The gateway is a strict additive
// superset (enforced by loxilb-subset.contract.test.ts); what each flavor may
// see is derived from the generated capability map, never hand-maintained.
export type InstanceFlavor = 'loxilb' | 'inference-gateway';

export const GATEWAY_PRODUCT = 'loxilb-inference-gateway';

// Flavor from a /version payload. A backend that identifies itself as the
// gateway gets the full surface; anything else — including every backend that
// predates the `product` field — is treated as plain loxilb. That direction is
// deliberate: misreading a gateway as loxilb only hides its extra features,
// while misreading loxilb as a gateway sends it enum values it 422s on and
// fields it silently drops.
export function detectFlavor(version: {product?: string} | null | undefined): InstanceFlavor {
	return version?.product === GATEWAY_PRODUCT ? 'inference-gateway' : 'loxilb';
}

//---------------------------------------------------------
// Feature families
//---------------------------------------------------------
// Each feature is the API path prefix (or prefixes) its pages/forms sit on.
// Availability on loxilb is decided by the capability map: a family whose
// prefixes appear under gatewayOnlyPaths does not exist upstream. If upstream
// later adopts a family, re-vendoring its spec flips the answer automatically.
const FEATURE_PATHS: Record<string, string[]> = {
	ai: ['/config/ai'],
	ipsec: ['/config/ipsec'],
	sniCerts: ['/config/cert', '/sni'],
	ipfilter: ['/config/ipfilter'],
	securityrate: ['/config/securityrate'],
	ipv6: ['/config/ipv6address'],
	trace: ['/config/trace'],
	l7policy: ['/config/l7policy'],
	// NOT here: the snapshot family (/config/export+import exist upstream —
	// verified live 2026-08-13 — persist/restore are gateway-only) and
	// /logs/archives. Neither backend declares those endpoints in its swagger,
	// so the generated map cannot see them; their pages get gated directly on
	// flavor until the specs declare the paths.
};
export type InstanceFeature = keyof typeof FEATURE_PATHS;

const gatewayOnlyPaths: string[] = capabilityMap.gatewayOnlyPaths;
const gatewayOnlyMethods: Record<string, string[]> = capabilityMap.gatewayOnlyMethods;
const gatewayOnlyFields: Record<string, string[]> = capabilityMap.gatewayOnlyFields;
const gatewayOnlyEnumValues: Record<string, (string | number)[]> = capabilityMap.gatewayOnlyEnumValues;

export function hasFeature(flavor: InstanceFlavor, feature: InstanceFeature): boolean {
	if (flavor === 'inference-gateway') return true;
	return !FEATURE_PATHS[feature].some(prefix => gatewayOnlyPaths.some(p => p === prefix || p.startsWith(`${prefix}/`)));
}

// Whether a method exists on a shared path for the flavor. `pathTemplate` is
// the swagger path template as it appears in the capability map, e.g.
// '/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}'
// (whose GET/PATCH are gateway-only — loxilb answers 405, so callers fall
// back, e.g. LB edit re-POSTs the full body as an upsert).
export function hasMethod(flavor: InstanceFlavor, method: string, pathTemplate: string): boolean {
	if (flavor === 'inference-gateway') return true;
	return !(gatewayOnlyMethods[pathTemplate] ?? []).includes(method.toLowerCase());
}

// Whether a write field exists on the flavor. `context` is the dotted schema
// path used by the capability map, e.g. 'LoadbalanceEntry.serviceArguments'
// or 'LoadbalanceEntry.endpoints[]'.
export function hasField(flavor: InstanceFlavor, context: string, field: string): boolean {
	if (flavor === 'inference-gateway') return true;
	return !(gatewayOnlyFields[context] ?? []).includes(field);
}

// Drops every gateway-only key from an outgoing object, for one schema
// `context`. The last line of defence before a payload hits the wire.
//
// Gating a CONTROL is not the same as not sending its field. A hidden control
// still has state, and defaults seeded for the form's own benefit — see
// EndpointListForm.handleAdd, which must seed `ep_role`/`nixl_port` or the
// dropdown's announce path deletes the row the user just added — ride along in
// the body regardless of what is on screen. Upstream loxilb currently drops
// unknown properties silently (go-swagger default), so the leak is invisible
// today and becomes a hard 422 the day it starts validating them.
//
// Applied per-object rather than by deep-walking the payload: the map is keyed
// by schema context, and two different contexts can legitimately use the same
// field name.
export function stripGatewayOnlyFields<T extends Record<string, any>>(flavor: InstanceFlavor, context: string, obj: T): T {
	if (flavor === 'inference-gateway') return obj;
	const gatewayOnly = gatewayOnlyFields[context] ?? [];
	if (gatewayOnly.length === 0) return obj;

	let stripped: T | undefined;
	for (const field of gatewayOnly) {
		if (field in obj) {
			// Copy lazily — the overwhelmingly common case is nothing to strip.
			stripped = stripped ?? {...obj};
			delete stripped[field];
		}
	}
	return stripped ?? obj;
}

// Filters an enum's send values down to what the flavor accepts, e.g.
// allowedEnumValues('loxilb', 'LoadbalanceEntry.serviceArguments.sel',
// sels.map(s => s.send_value)). Values the gateway added over loxilb are
// hard 422s upstream, so options must disappear rather than error.
export function allowedEnumValues<T extends string | number>(flavor: InstanceFlavor, context: string, values: T[]): T[] {
	if (flavor === 'inference-gateway') return values;
	const gatewayOnly = gatewayOnlyEnumValues[context] ?? [];
	return values.filter(v => !gatewayOnly.includes(v));
}
