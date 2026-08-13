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
	// flavor in Phase 3 until the specs declare the paths.
};
export type InstanceFeature = keyof typeof FEATURE_PATHS;

const gatewayOnlyPaths: string[] = capabilityMap.gatewayOnlyPaths;
const gatewayOnlyFields: Record<string, string[]> = capabilityMap.gatewayOnlyFields;
const gatewayOnlyEnumValues: Record<string, (string | number)[]> = capabilityMap.gatewayOnlyEnumValues;

export function hasFeature(flavor: InstanceFlavor, feature: InstanceFeature): boolean {
	if (flavor === 'inference-gateway') return true;
	return !FEATURE_PATHS[feature].some(prefix => gatewayOnlyPaths.some(p => p === prefix || p.startsWith(`${prefix}/`)));
}

// Whether a write field exists on the flavor. `context` is the dotted schema
// path used by the capability map, e.g. 'LoadbalanceEntry.serviceArguments'
// or 'LoadbalanceEntry.endpoints[]'.
export function hasField(flavor: InstanceFlavor, context: string, field: string): boolean {
	if (flavor === 'inference-gateway') return true;
	return !(gatewayOnlyFields[context] ?? []).includes(field);
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
