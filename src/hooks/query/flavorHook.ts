//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {allowedEnumValues, detectFlavor, hasFeature, hasField, hasMethod, InstanceFeature, InstanceFlavor} from 'api/capabilities';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {query_get_version} from 'connector/instance/status';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import {useInstanceFromURL} from '../instanceHook';

//---------------------------------------------------------
// Flavor detection
//---------------------------------------------------------
// Detects whether an instance is plain upstream loxilb or the inference
// gateway, from GET /version's `product` field (absent ⇒ loxilb — see
// api/capabilities.ts for why that direction is the safe default). The
// react-query cache keyed by instance id is the client-side store the
// backward-compat plan calls for; a session sees one probe per instance,
// re-detected on reconnect/refresh because failures are not cached.

// The four situations a consumer must be able to tell apart. Collapsing
// them into `flavor === undefined` (as this hook once did) made a security
// denial indistinguishable from a probe still in flight.
export type FlavorResolution =
	| {state: 'loading'}
	| {state: 'denied'; httpStatus: 401 | 403}
	| {state: 'unavailable'} // transport / 5xx / retries exhausted
	| {state: 'resolved'; flavor: InstanceFlavor};

export function useInstanceFlavorResolution(instance: IInstance | null): FlavorResolution {
	const query = useQuery({
		queryKey: ['instance', 'flavor', instance?.id],
		queryFn: async () => detectFlavor(await query_get_version(instance!)),
		enabled: !!instance,
		staleTime: Infinity,
		gcTime: Infinity,
		// Never retry an auth denial: it cannot self-heal and hammering the
		// endpoint pressures the OAM login rate limiter. Transport/5xx get
		// two retries.
		retry: (count, err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)) && count < 2,
	});
	if (query.data !== undefined) return {state: 'resolved', flavor: query.data};
	if (query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403)) {
		return {state: 'denied', httpStatus: query.error.status};
	}
	if (query.isError) return {state: 'unavailable'};
	return {state: 'loading'};
}

// Back-compat shape for consumers that only need the resolved flavor
// (metrics naming tables, guards' flavor equality).
export function useInstanceFlavor(instance: IInstance | null): {flavor: InstanceFlavor | undefined; resolved: boolean} {
	const resolution = useInstanceFlavorResolution(instance);
	if (resolution.state === 'resolved') return {flavor: resolution.flavor, resolved: true};
	return {flavor: undefined, resolved: false};
}

//---------------------------------------------------------
// Capability surface for the instance in the URL
//---------------------------------------------------------
export interface IInstanceCapabilities {
	flavor: InstanceFlavor | undefined;
	// false while the /version probe is in flight (or no instance selected).
	resolved: boolean;
	// Full detail so pages/guards can render loading vs denied vs
	// unavailable distinctly — a denial must never look like an empty
	// healthy product.
	resolution: FlavorResolution;
	hasFeature: (feature: InstanceFeature) => boolean;
	hasField: (context: string, field: string) => boolean;
	hasMethod: (method: string, pathTemplate: string) => boolean;
	allowedEnum: <T extends string | number>(context: string, values: T[]) => T[];
}

// Instance identity travels in ?name=, so consumers re-evaluate on instance
// switch for free. FAIL-NARROW: until the flavor RESOLVES, the helpers
// answer as plain loxilb — the narrowest set. The previous broad-while-
// unresolved default meant a denied or unreachable probe exposed
// gateway-only write controls for the whole session (stop-ship in the
// certification profile). Do not revert to a broad default — CI greps
// against the gateway-flavor nullish fallback pattern.
export function useInstanceCapabilities(): IInstanceCapabilities {
	const instance = useInstanceFromURL();
	const resolution = useInstanceFlavorResolution(instance);

	return useMemo(() => {
		const resolved = resolution.state === 'resolved';
		const flavor = resolution.state === 'resolved' ? resolution.flavor : undefined;
		const effective: InstanceFlavor = resolution.state === 'resolved' ? resolution.flavor : 'loxilb';
		return {
			flavor,
			resolved,
			resolution,
			hasFeature: (feature: InstanceFeature) => hasFeature(effective, feature),
			hasField: (context: string, field: string) => hasField(effective, context, field),
			hasMethod: (method: string, pathTemplate: string) => hasMethod(effective, method, pathTemplate),
			allowedEnum: <T extends string | number>(context: string, values: T[]) => allowedEnumValues(effective, context, values),
		};
	}, [resolution]);
}
