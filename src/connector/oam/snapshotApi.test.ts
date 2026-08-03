//---------------------------------------------------------
// Connector error-path tests (docs/SNAPSHOT_UI_DESIGN.md §9.1).
//
// The invariants under test are the honesty rules: reads THROW on non-2xx
// (so react-query shows the error banner, never a false "No rows"),
// mutations surface the server error verbatim, and a restore whose gateway
// leg failed still resolves as success with the failure captured in the
// outcome (OAM answers 200 + gateway_status — the wizard renders the truth).
//---------------------------------------------------------
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {ApiError} from '../fetcher/fetcher_base';
import {
	query_get_snapshot_schedule,
	query_get_snapshots,
	request_delete_snapshot,
	request_restore_snapshot,
	request_take_snapshot,
} from './snapshotApi';

function mockFetch(body: string, status = 200) {
	(global.fetch as Mock).mockResolvedValue(new Response(body, {status, headers: {'Content-Type': 'application/json'}}));
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('snapshot reads (assertOk → error banner)', () => {
	it('query_get_snapshots throws ApiError on 500 instead of returning empty rows', async () => {
		mockFetch('{"error":"db gone"}', 500);
		await expect(query_get_snapshots(1, {page: 1, limit: 20})).rejects.toBeInstanceOf(ApiError);
	});

	it('query_get_snapshot_schedule throws ApiError on 502', async () => {
		mockFetch('{"error":"gateway unreachable"}', 502);
		await expect(query_get_snapshot_schedule(1)).rejects.toBeInstanceOf(ApiError);
	});

	it('query_get_snapshots returns the paginated body on 200', async () => {
		mockFetch('{"data":[{"id":"s1","name":"pre-upgrade"}],"pagination":{"total_count":1}}');
		const list = await query_get_snapshots(1, {page: 1, limit: 20});
		expect(list.data?.[0].name).toBe('pre-upgrade');
		expect(list.pagination?.total_count).toBe(1);
	});
});

describe('snapshot mutations (verbatim server errors)', () => {
	it('request_take_snapshot passes the gateway 502 body through', async () => {
		mockFetch('{"error":"gateway unreachable: connect: connection refused"}', 502);
		const res = await request_take_snapshot(1, {name: 'x'});
		expect(res.status).toBe('error');
		expect(res.error).toContain('502');
	});

	it('request_take_snapshot returns the created snapshot on 201', async () => {
		mockFetch('{"id":"s2","name":"x","trigger_type":"manual"}', 201);
		const res = await request_take_snapshot(1, {name: 'x'});
		expect(res.status).toBe('success');
		expect(res.snapshot?.id).toBe('s2');
	});

	it('request_delete_snapshot surfaces the pinned-refusal error', async () => {
		mockFetch('{"error":"snapshot is pinned; unpin it or pass force=true"}', 409);
		const res = await request_delete_snapshot('s1');
		expect(res.status).toBe('error');
		expect(res.error).toContain('pinned');
	});
});

describe('request_restore_snapshot (the 200-with-failure contract)', () => {
	it('resolves success with the rolled-back result inside the outcome', async () => {
		mockFetch(
			JSON.stringify({
				snapshot_id: 's1',
				instance_id: 1,
				mode: 'commit',
				gateway_status: 500,
				gateway_response: {result: 'rolled-back', errors: ['apply lb: boom']},
			}),
		);
		const res = await request_restore_snapshot('s1', 'commit');
		expect(res.status).toBe('success');
		if (res.status === 'success') {
			expect(res.outcome.gateway_status).toBe(500);
			expect(res.outcome.gateway_response?.result).toBe('rolled-back');
		}
	});

	it('errors when OAM refuses before the gateway leg (integrity 422)', async () => {
		mockFetch('{"error":"stored snapshot failed integrity verification"}', 422);
		const res = await request_restore_snapshot('s1', 'dry-run');
		expect(res.status).toBe('error');
		if (res.status === 'error') expect(res.error).toContain('integrity');
	});

	it('resolves an error result (never rejects) when the OAM host is unreachable', async () => {
		// fetch_data RETHROWS network failures; an uncaught rejection here left
		// the wizard stuck on its non-dismissable committing screen (§9.3 case 3).
		(global.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
		const res = await request_restore_snapshot('s1', 'commit');
		expect(res.status).toBe('error');
		if (res.status === 'error') expect(res.error).toMatch(/unreachable|Failed to fetch/);
	});
});
