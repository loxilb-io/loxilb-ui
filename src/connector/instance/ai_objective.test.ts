//---------------------------------------------------------
// Objectives and net identities on the wire (gateway 9f5017e2).
//
// Pins: the exact collection routes (no /all); a route 404 is an error, never
// an empty list; a body without the list is malformed, not empty; an objective
// write sends no updated_at and leaves empty services out; a 504 on a write is
// "outcome unknown"; the named-object 404 on delete is reported as such.
//---------------------------------------------------------
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {fromThrownError} from 'connector/fetcher/opResultAdapter';
import {IInstance} from 'types/oam';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {query_get_netidentities, query_get_objectives, request_delete_objective, request_upsert_objective, validateObjective} from './ai_objective';

vi.mock('../fetcher/fetcher_inst', () => ({
	DELETE_INST: vi.fn(),
	GET_INST: vi.fn(),
	POST_INST: vi.fn(),
}));

const instance = {id: 1, name: 'gateway'} as IInstance;
const get = vi.mocked(GET_INST);
const post = vi.mocked(POST_INST);
const del = vi.mocked(DELETE_INST);

beforeEach(() => {
	get.mockReset();
	post.mockReset();
	del.mockReset();
});

describe('reading objectives', () => {
	it('reads the collection route and keeps the provenance apart from the list', async () => {
		get.mockResolvedValue({code: 200, data: {objectiveAttr: [{name: 'gold', priority: 5}], source: 'store', source_timestamp: '2026-10-27T03:00:00Z', store_reachable: false, store_last_read: '2026-10-27T02:59:00Z'}, message: ''} as never);
		const list = await query_get_objectives(instance);
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/objective');
		expect(list).toEqual({
			objectives: [{name: 'gold', priority: 5}],
			source: 'store',
			sourceTimestamp: '2026-10-27T03:00:00Z',
			storeReachable: false,
			storeLastRead: '2026-10-27T02:59:00Z',
		});
	});

	it('reads a null list as empty, the way a nil slice is served', async () => {
		get.mockResolvedValue({code: 200, data: {objectiveAttr: null, source: 'store', store_reachable: true}, message: ''} as never);
		expect((await query_get_objectives(instance)).objectives).toEqual([]);
	});

	it('throws on a route 404 instead of answering an empty list', async () => {
		get.mockResolvedValue({code: 404, data: null, message: 'Not Found'} as never);
		const error = await query_get_objectives(instance).catch(e => e);
		expect(error).toBeInstanceOf(ApiError);
		expect(fromThrownError('ai_objective.list', error).httpStatus).toBe(404);
	});

	it('throws on a 503 (no key store, nothing applied) as unavailable', async () => {
		get.mockResolvedValue({code: 503, data: {message: 'ai_key_store_unconfigured'}, message: ''} as never);
		const error = await query_get_objectives(instance).catch(e => e);
		expect(fromThrownError('ai_objective.list', error).status).toBe('unavailable');
	});

	it('throws on a body that carries no list', async () => {
		get.mockResolvedValue({code: 200, data: {objectiveAttr: 'nope'}, message: ''} as never);
		await expect(query_get_objectives(instance)).rejects.toBeInstanceOf(ApiError);
		get.mockResolvedValue({code: 200, data: [], message: ''} as never);
		await expect(query_get_objectives(instance)).rejects.toBeInstanceOf(ApiError);
	});
});

describe('writing objectives', () => {
	it('sends name, priority and non-empty services, never updated_at', async () => {
		post.mockResolvedValue({code: 200, data: {result: 'Success'}, message: ''} as never);
		const res = await request_upsert_objective(instance, {name: 'gold', priority: 5, services: [], updated_at: '2026-10-27T00:00:00Z'});
		expect(res.status).toBe('confirmed');
		expect(post).toHaveBeenCalledWith(instance, '/config/ai/objective', {name: 'gold', priority: 5});
		await request_upsert_objective(instance, {name: 'gold', priority: -1, services: ['10.0.0.1:443']});
		expect(post).toHaveBeenLastCalledWith(instance, '/config/ai/objective', {name: 'gold', priority: -1, services: ['10.0.0.1:443']});
	});

	it('keeps an invalid name off the wire', async () => {
		const res = await request_upsert_objective(instance, {name: 'tier:fast', priority: 1});
		expect(res.status).toBe('invalid');
		expect(post).not.toHaveBeenCalled();
	});

	it('reports a 504 as outcome unknown, not as a failure', async () => {
		post.mockResolvedValue({code: 504, data: {code: 'ai_key_store_outcome_unknown'}, message: ''} as never);
		expect((await request_upsert_objective(instance, {name: 'gold', priority: 1})).status).toBe('unknown');
	});

	it('deletes by name on the named route and keeps the 404 status', async () => {
		del.mockResolvedValue({code: 404, data: {message: 'not found'}, message: ''} as never);
		const res = await request_delete_objective(instance, 'gold');
		expect(del).toHaveBeenCalledWith(instance, '/config/ai/objective/gold');
		expect(res.httpStatus).toBe(404);
	});
});

describe('objective validation follows the contract', () => {
	it('accepts names of letters, digits, -, _ and . up to 63', () => {
		expect(validateObjective({name: 'gold.v2_a-b', priority: 0})).toEqual([]);
		expect(validateObjective({name: 'a'.repeat(63), priority: 0})).toEqual([]);
		expect(validateObjective({name: 'a'.repeat(64), priority: 0})).toHaveLength(1);
		expect(validateObjective({name: 'has space', priority: 0})).toHaveLength(1);
		expect(validateObjective({name: '', priority: 0})).toHaveLength(1);
	});

	it('bounds the priority to int32', () => {
		expect(validateObjective({name: 'x', priority: 2147483647})).toEqual([]);
		expect(validateObjective({name: 'x', priority: -2147483648})).toEqual([]);
		expect(validateObjective({name: 'x', priority: 2147483648})).toHaveLength(1);
		expect(validateObjective({name: 'x', priority: 1.5})).toHaveLength(1);
	});
});

describe('reading network identities', () => {
	it('reads the collection route and the list', async () => {
		get.mockResolvedValue({code: 200, data: {netIdentityAttr: [{name: 'lab', tenant: 'acme'}]}, message: ''} as never);
		expect(await query_get_netidentities(instance)).toEqual([{name: 'lab', tenant: 'acme'}]);
		expect(get).toHaveBeenCalledWith(instance, '/config/ai/netidentity');
	});

	it('throws on a route 404', async () => {
		get.mockResolvedValue({code: 404, data: null, message: ''} as never);
		await expect(query_get_netidentities(instance)).rejects.toBeInstanceOf(ApiError);
	});
});
