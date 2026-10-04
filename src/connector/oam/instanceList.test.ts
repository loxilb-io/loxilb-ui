//---------------------------------------------------------
// The instance-list read must always hand back a list.
// (npm test src/connector/oam/instanceList.test.ts)
//
// Found by a full-suite AFTER-run, not by the task's own tests: the
// walkthrough failed with 121 console errors, headed by
//
//     pageerror: instance_list.find is not a function
//     The above error occurred in the <LBRulePage> component
//     Route render error: TypeError: instance_list.find is not a function
//
// `query_get_instance_list` casts the parsed body straight to IInstance[]:
//
//     return (resp.data ?? []) as IInstance[];
//
// `??` only guards null/undefined, so ANY other JSON shape — an error object,
// a string, a number — passes through as if it were a list. Every instance
// page then calls .find on it: useInstanceFromURL (instanceHook.ts:19) and
// get_instance / get_instance_name (oamHooks.ts:24-25). The result is a
// TypeError during render, which takes the whole route to RouteErrorBoundary.
//
// An unexplained page error counts as an outright failure,
// and the operator sees a blank page rather than anything they can act on.
//
// ⚠ SCOPE: this pins only that the read cannot crash its consumers. Whether a
// bad instance-list response should instead SURFACE as an error (rather than
// read as "no instances") is the page-state work's call — that read feeds SetupHandler and
// flavor probing, so making it throw touches app start-up, which is exactly
// why the prep notes flag it. Either decision satisfies this
// test; neither is allowed to reach .find with a non-array.
//---------------------------------------------------------
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {GET_OAM} from '../fetcher/fetcher_oam';
import {query_get_instance_list} from './oam';

vi.mock('../fetcher/fetcher_oam', () => ({GET_OAM: vi.fn()}));

const mockGet = vi.mocked(GET_OAM);

/** Whatever the read returns must survive the .find every instance page does. */
function consumersSurvive(list: unknown): boolean {
	try {
		(list as {find: (p: (i: unknown) => boolean) => unknown}).find(() => true);
		return true;
	} catch {
		return false;
	}
}

beforeEach(() => {
	mockGet.mockReset();
});

describe('query_get_instance_list', () => {
	it('returns the list on a normal response', async () => {
		mockGet.mockResolvedValue({code: 200, data: [{id: 1, name: 'gw-1'}], message: 'OK'} as any);
		await expect(query_get_instance_list()).resolves.toEqual([{id: 1, name: 'gw-1'}]);
	});

	it('returns an empty list for an empty body', async () => {
		mockGet.mockResolvedValue({code: 200, data: null, message: 'OK'} as any);
		await expect(query_get_instance_list()).resolves.toEqual([]);
	});

	it.each([
		['an error object', {result: 'fail', message: 'boom'}],
		['a bare object', {}],
		['a string', 'unauthorized'],
		['a number', 0],
		['a boolean', false],
	])('RED: %s does not reach the pages as if it were a list', async (_label, payload) => {
		mockGet.mockResolvedValue({code: 200, data: payload, message: 'OK'} as any);

		const list = await query_get_instance_list();

		expect(Array.isArray(list), `payload ${JSON.stringify(payload)} produced a non-array`).toBe(true);
		expect(consumersSurvive(list), 'every instance page calls .find on this value').toBe(true);
	});
});
