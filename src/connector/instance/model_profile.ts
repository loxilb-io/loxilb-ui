//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IKvExactStatusEntry, IModelProfileEntry, IModelProfileRegistry} from 'types/ai_gateway';
import {IInstance} from 'types/oam';
import {ApiError, assertOk} from '../fetcher/fetcher_base';
import {GET_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// AI Model Profiles (/config/ai/model-profiles) — READ ONLY
//
// The profile registry is operator-published on the gateway; this UI reads,
// selects, and observes it. There is deliberately no mutation function in
// this module and none may be added: POST/PUT/PATCH/DELETE against
// /config/ai/model-profiles* is a requirements violation (read-only
// inventory, AC-12).
//---------------------------------------------------------

/**
 * The currently published profile registry. registryGeneration 0 with an
 * empty profiles array is the documented no-registry-published (legacy)
 * state — a normal payload, never an error.
 */
export async function query_get_model_profiles(instance: IInstance): Promise<IModelProfileRegistry> {
	const resp = await GET_INST<GwGetResp<'/config/ai/model-profiles'>>(instance, `/config/ai/model-profiles`);
	assertOk(resp, 'Get Model Profiles');
	const data = resp.data as IModelProfileRegistry | undefined;
	// Malformed/non-object bodies must not white-screen the inventory page;
	// normalize to the documented empty state and let the table render it.
	if (!data || !Array.isArray(data.profiles)) return {registryGeneration: 0, profiles: []};
	return data;
}

/**
 * One published profile. 404 answers "not in the currently published
 * generation" (stale selection) and surfaces as an ApiError with status 404
 * so callers can offer a registry refresh instead of a generic failure.
 */
export async function query_get_model_profile(instance: IInstance, profileId: string): Promise<IModelProfileEntry> {
	const detailPath = `/config/ai/model-profiles/${encodeURIComponent(profileId)}`;
	const resp = await GET_INST<GwGetResp<'/config/ai/model-profiles/{profile_id}'>>(instance, detailPath);
	assertOk(resp, 'Get Model Profile');
	return resp.data as IModelProfileEntry;
}

//---------------------------------------------------------
// KV-exact enforcement status (dedicated read model)
//---------------------------------------------------------

export interface IKvExactStatusKey {
	externalIP: string;
	port: number;
	protocol: string;
	/** Restrict to the rule serving this model name; absent = every KV-exact rule on the key. */
	modelName?: string;
}

/**
 * Resolved KV-exact status for the rules on a composite LB key.
 *
 * Returns null on 404 — the contract deliberately coalesces "no rule on the
 * key", "rule is not KV-exact", and "model filter matched nothing" into 404,
 * and all three mean "no KV-exact status for this selection": a normal
 * answer the panel renders inline, never an error path or a redirect.
 * Every other non-2xx (401/403/422/500/503) throws for the caller's error
 * handling; a 200 body contractually carries at least one entry.
 */
export async function query_get_kvexact_status(instance: IInstance, key: IKvExactStatusKey): Promise<IKvExactStatusEntry[] | null> {
	const path = `/config/loadbalancer/externalipaddress/${encodeURIComponent(key.externalIP)}/port/${key.port}/protocol/${encodeURIComponent(key.protocol)}/kvexactstatus`;
	try {
		const resp = await GET_INST<GwGetResp<'/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}/kvexactstatus'>>(
			instance,
			path,
			key.modelName ? {model_name: key.modelName} : undefined,
		);
		assertOk(resp, 'Get KV Exact Status');
		return (resp.data?.kvExactStatusAttr ?? []) as IKvExactStatusEntry[];
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return null;
		throw error;
	}
}
