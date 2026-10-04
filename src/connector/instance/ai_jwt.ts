//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IJWTAuthProfileEntry} from 'types/ai_jwt';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// AI JWT auth profiles (/config/ai/jwtauthprofile)
//
// A profile is a named issuer configuration — an IdP, its keys, and the claim
// schema to read identity out of a token. LB rules reference one BY NAME, and
// several rules may share one profile.
//---------------------------------------------------------

/**
 * List every configured JWT auth profile.
 *
 * ⚠️ This reports DESIRED CONFIGURATION ONLY. It says nothing about whether the
 * issuer is reachable or its keyset healthy — a profile can list here and still
 * be failing closed on the data plane. Key-store health is a separate question
 * answered by the loxilb_ai_jwks_* families, not by this call.
 */
export async function query_get_jwtauthprofile_all(instance: IInstance): Promise<IJWTAuthProfileEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/ai/jwtauthprofile'>>(instance, `/config/ai/jwtauthprofile`);
	// A non-2xx (gateway 501/502, or the license gate's 402) must surface so
	// the table shows a retry banner instead of a silent "No rows".
	assertOk(resp, 'Get JWT Auth Profiles');
	// The 402 license-gate body is a JSON error OBJECT, not an array; the list
	// lives under jwtAuthProfileAttr. Never pass a non-array through — mapping
	// it in the page would throw and white-screen the app.
	const list = resp.data?.jwtAuthProfileAttr;
	return Array.isArray(list) ? list : [];
}

/**
 * Create or replace a profile.
 *
 * ⚠️ POST is create-OR-REPLACE and there is NO PATCH, so an edit must send the
 * WHOLE entry: a partial body does not merge, it replaces, and every field the
 * caller left out reverts to its default.
 *
 * ⚠️ Replacing an existing name RESTARTS the key lifecycle — the profile
 * answers 503-class on the data plane until the first JWKS fetch against the
 * new configuration succeeds (fail-closed). Activation does not wait for that
 * fetch, so a 200 here is NOT proof the issuer is reachable or the config
 * correct; it only means the gateway accepted it.
 */
export async function request_upsert_jwtauthprofile(instance: IInstance, data: IJWTAuthProfileEntry): Promise<OpResult> {
	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/ai/jwtauthprofile`, data), 'ai.jwtprofile.upsert');
	} catch (error) {
		return fromNetworkError('ai.jwtprofile.upsert', error);
	}
}

/**
 * Delete a profile by name.
 *
 * A profile referenced by ANY LB rule is not deletable — the gateway answers
 * 409, which the adapter maps to `invalid`. The page names the referencing
 * rules rather than surfacing a bare status code, because "detach it from
 * every rule first" is only actionable once the operator knows which rules.
 */
export async function request_delete_jwtauthprofile(instance: IInstance, name: string): Promise<OpResult> {
	try {
		return fromSimpleResponse(await DELETE_INST(instance, `/config/ai/jwtauthprofile/${encodeURIComponent(name)}`), 'ai.jwtprofile.delete');
	} catch (error) {
		return fromNetworkError('ai.jwtprofile.delete', error);
	}
}
