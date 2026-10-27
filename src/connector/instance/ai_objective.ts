//---------------------------------------------------------
// AI objectives (/config/ai/objective) and network identities
// (/config/ai/netidentity) — gateway 9f5017e2.
//
// Objectives: named request priorities. POST creates or replaces by name;
// there is no PUT or PATCH. They live in the AI key store, so a write is
// refused 503 without one and while it does not answer.
//
// Net identities are read-only here: bindings are created and removed with
// loxicmd or the API.
//
// Read states the pages must keep apart:
//   200 with a list   the list, with where it came from (store or lkg)
//   404               this gateway does not serve the route; never an empty list
//   503               no key store, or it does not answer and nothing was applied
//   401/403/402       denied
//---------------------------------------------------------
import type {GwGetResp, GwSchema} from 'api';
import {IAIObjectiveEntry} from 'types/ai_priority';
import {IInstance} from 'types/oam';
import {ApiError, assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';
import {pathRefusal, unsendableInPath} from '../fetcher/pathSegment';

export type INetIdentityEntry = GwSchema<'NetIdentityEntry'>;

/** The objective list and its provenance, as one read returns them. */
export interface IObjectiveList {
	objectives: IAIObjectiveEntry[];
	/** store or lkg, as the gateway says; an unknown token is kept as sent. */
	source?: string;
	/** When the key store answered with this list. */
	sourceTimestamp?: string;
	/** Whether the store answered THIS read; false during an outage, whatever source says. */
	storeReachable?: boolean;
	/** When a read of the store last answered in this process. */
	storeLastRead?: string;
}

/** The locale key a route-404 is shown with: the route is named, never an empty list. */
export const OBJECTIVE_ROUTE_MISSING = 'This gateway does not serve /config/ai/objective. It may be older than objectives.';
export const NETIDENTITY_ROUTE_MISSING = 'This gateway does not serve /config/ai/netidentity. It may be older than network identities.';

/** The name rule from the objective contract: 1–63 of letters, digits, '-', '_', '.', never tier:. */
export const OBJECTIVE_NAME = /^[A-Za-z0-9._-]{1,63}$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function routeMissing(operation: string, resp: {code: number}): never {
	throw new ApiError(`${operation}: route not served (404)`, resp.code);
}

export async function query_get_objectives(instance: IInstance): Promise<IObjectiveList> {
	const resp = await GET_INST<GwGetResp<'/config/ai/objective'>>(instance, `/config/ai/objective`);
	if (resp.code === 404) routeMissing('Get Objectives', resp);
	assertOk(resp, 'Get Objectives');
	const data: unknown = resp.data;
	// A license-gate or proxy body is an object without the list, or no
	// object at all: a malformed answer, never an empty list.
	if (!isObject(data)) throw new ApiError('Get Objectives: the answer is not an objective list', 500);
	const list = data.objectiveAttr;
	if (list !== undefined && list !== null && !Array.isArray(list)) throw new ApiError('Get Objectives: objectiveAttr is not a list', 500);
	return {
		objectives: (list ?? []) as IAIObjectiveEntry[],
		source: typeof data.source === 'string' ? data.source : undefined,
		sourceTimestamp: typeof data.source_timestamp === 'string' ? data.source_timestamp : undefined,
		storeReachable: typeof data.store_reachable === 'boolean' ? data.store_reachable : undefined,
		storeLastRead: typeof data.store_last_read === 'string' ? data.store_last_read : undefined,
	};
}

/** Field errors for an objective body; English source strings. */
export function validateObjective(entry: IAIObjectiveEntry): string[] {
	const errors: string[] = [];
	const name = entry.name ?? '';
	if (name.startsWith('tier:')) errors.push('An objective name cannot begin with tier:.');
	else if (!OBJECTIVE_NAME.test(name)) errors.push('Objective name must be 1 to 63 letters, digits, -, _ or .');
	const priority = entry.priority;
	if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < -2147483648 || priority > 2147483647) {
		errors.push('Priority must be a whole number from -2147483648 to 2147483647.');
	}
	const services = entry.services ?? [];
	if (services.length > 256) errors.push('At most 256 services.');
	if (new Set(services).size !== services.length) errors.push('A service is listed twice.');
	return errors;
}

/**
 * Create or replace an objective. `updated_at` is the gateway's and is never
 * sent; empty services are left out (empty means every service).
 */
export async function request_upsert_objective(instance: IInstance, entry: IAIObjectiveEntry): Promise<OpResult> {
	const body: IAIObjectiveEntry = {
		name: entry.name,
		priority: entry.priority,
		...(entry.services && entry.services.length > 0 ? {services: entry.services} : {}),
	};
	const errors = validateObjective(body);
	if (errors.length > 0) {
		return {status: 'invalid', code: 'ai.objective.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, retryable: false, rawDetail: errors.join(' ')};
	}
	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/ai/objective`, body), 'ai.objective.upsert');
	} catch (error) {
		return fromNetworkError('ai.objective.upsert', error);
	}
}

/**
 * Remove an objective by name. A tenant or key that still names it keeps the
 * name; a request asking for it is then treated as asking for an unknown
 * objective.
 */
export async function request_delete_objective(instance: IInstance, name: string): Promise<OpResult> {
	if (name === '' || unsendableInPath(name)) return pathRefusal('ai.objective.delete');
	try {
		return fromSimpleResponse(await DELETE_INST(instance, `/config/ai/objective/${encodeURIComponent(name)}`), 'ai.objective.delete');
	} catch (error) {
		return fromNetworkError('ai.objective.delete', error);
	}
}

export async function query_get_netidentities(instance: IInstance): Promise<INetIdentityEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/ai/netidentity'>>(instance, `/config/ai/netidentity`);
	if (resp.code === 404) routeMissing('Get Network Identities', resp);
	assertOk(resp, 'Get Network Identities');
	const data: unknown = resp.data;
	if (!isObject(data)) throw new ApiError('Get Network Identities: the answer is not a binding list', 500);
	const list = data.netIdentityAttr;
	if (list !== undefined && list !== null && !Array.isArray(list)) throw new ApiError('Get Network Identities: netIdentityAttr is not a list', 500);
	return (list ?? []) as INetIdentityEntry[];
}
