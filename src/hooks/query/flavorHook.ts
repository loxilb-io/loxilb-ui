//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {allowedEnumValues, detectFlavor, hasFeature, hasField, hasMethod, InstanceFeature, InstanceFlavor} from 'api/capabilities';
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
export function useInstanceFlavor(instance: IInstance | null): {flavor: InstanceFlavor | undefined; resolved: boolean} {
	const query = useQuery({
		queryKey: ['instance', 'flavor', instance?.id],
		queryFn: async () => detectFlavor(await query_get_version(instance!)),
		enabled: !!instance,
		staleTime: Infinity,
		gcTime: Infinity,
		retry: 1,
	});
	return {flavor: query.data, resolved: query.data !== undefined};
}

//---------------------------------------------------------
// Capability surface for the instance in the URL
//---------------------------------------------------------
export interface IInstanceCapabilities {
	flavor: InstanceFlavor | undefined;
	// false while the /version probe is in flight (or no instance selected).
	resolved: boolean;
	hasFeature: (feature: InstanceFeature) => boolean;
	hasField: (context: string, field: string) => boolean;
	hasMethod: (method: string, pathTemplate: string) => boolean;
	allowedEnum: <T extends string | number>(context: string, values: T[]) => T[];
}

// Instance identity travels in ?name=, so consumers re-evaluate on instance
// switch for free. Until the flavor resolves the helpers answer as the
// gateway (today's behavior — nothing disappears while probing); flavor-gated
// WRITE controls should additionally check `resolved` if flashing an option
// that later vanishes would mislead.
export function useInstanceCapabilities(): IInstanceCapabilities {
	const instance = useInstanceFromURL();
	const {flavor, resolved} = useInstanceFlavor(instance);

	return useMemo(() => {
		const effective: InstanceFlavor = flavor ?? 'inference-gateway';
		return {
			flavor,
			resolved,
			hasFeature: (feature: InstanceFeature) => hasFeature(effective, feature),
			hasField: (context: string, field: string) => hasField(effective, context, field),
			hasMethod: (method: string, pathTemplate: string) => hasMethod(effective, method, pathTemplate),
			allowedEnum: <T extends string | number>(context: string, values: T[]) => allowedEnumValues(effective, context, values),
		};
	}, [flavor, resolved]);
}
