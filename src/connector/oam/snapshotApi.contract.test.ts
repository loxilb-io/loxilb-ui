import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ApiError} from '../fetcher/fetcher_base';
import {query_get_snapshots, request_take_snapshot, request_upload_snapshot, request_patch_snapshot} from './snapshotApi';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); localStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());
function answer(body: unknown, status = 200) {
	vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}}));
}

describe('snapshot response contract', () => {
	it.each([null, {}, [], {data: null}, {data: 'broken'}, {data: [{}]}])('does not turn malformed list %j into trusted rows', async body => {
		answer(body);
		await expect(query_get_snapshots(1)).rejects.toBeInstanceOf(ApiError);
	});
	it('accepts a genuinely empty server list', async () => {
		answer({data: [], pagination: {total_count: 0}});
		expect((await query_get_snapshots(1)).data).toEqual([]);
	});
	it.each([null, {}, [], {id: ''}, {id: 7}])('does not confirm capture without a usable snapshot id: %j', async body => {
		answer(body, 201);
		const res = await request_take_snapshot(1, {name: 'test'});
		expect(res.status).toBe('unknown');
		expect(res.retryable).toBe(false);
		expect(res.data).toBeUndefined();
	});
	it('upload with a malformed success must be read back before retry', async () => {
		answer({}, 201);
		expect((await request_upload_snapshot(1, new File(['{}'], 'backup.json'))).status).toBe('unknown');
	});
	it('pin with a malformed success cannot produce a pinned success popup', async () => {
		answer({});
		expect((await request_patch_snapshot('sid', {pinned: true})).status).toBe('unknown');
	});
	it('does not confirm metadata for another snapshot', async () => {
		answer({id: 'other', name: 'other', pinned: true});
		expect((await request_patch_snapshot('sid', {pinned: true})).status).toBe('unknown');
	});
	it.each([{}, {pinned: false}, {pinned: 'true'}])('does not confirm pin without the requested pinned state: %j', async state => {
		answer({id: 'sid', ...state});
		const res = await request_patch_snapshot('sid', {pinned: true});
		expect(res.status).toBe('unknown');
		expect(res.retryable).toBe(false);
	});
	it('unpin requires the returned false state', async () => {
		answer({id: 'sid', pinned: true});
		expect((await request_patch_snapshot('sid', {pinned: false})).status).toBe('unknown');
		answer({id: 'sid', pinned: false});
		expect((await request_patch_snapshot('sid', {pinned: false})).status).toBe('confirmed');
	});
	it('keeps healthy capture and pin responses usable', async () => {
		answer({id: 'sid', name: 'test'}, 201);
		expect((await request_take_snapshot(1, {name: 'test'})).status).toBe('confirmed');
		answer({id: 'sid', pinned: true});
		expect((await request_patch_snapshot('sid', {pinned: true})).status).toBe('confirmed');
	});
});
