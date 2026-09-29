//---------------------------------------------------------
// Snapshot list refresh after a mutation
//---------------------------------------------------------
// React Query joins an in-flight fetch on refetch/invalidate while the query
// has no data yet (cancelRefetch only applies once data exists). A snapshot
// taken while the page's FIRST list GET is still in flight must therefore not
// be answered by that GET: the invalidate has to start a fresh one, or the
// new row never appears until the next manual refresh.

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {query_get_snapshot_schedule, query_get_snapshots} from 'connector/oam/snapshotApi';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useInvalidateSnapshots, useSnapshots} from './snapshotHooks';

vi.mock('connector/oam/snapshotApi', () => ({query_get_snapshots: vi.fn(), query_get_snapshot_schedule: vi.fn()}));

const listGet = vi.mocked(query_get_snapshots);
const scheduleGet = vi.mocked(query_get_snapshot_schedule);

const page = (ids: string[]) => ({data: ids.map(id => ({id})), pagination: {total_count: ids.length}}) as any;

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	listGet.mockReset();
	scheduleGet.mockReset();
	scheduleGet.mockResolvedValue({} as any);
});
afterEach(() => {
	cleanup();
	client.clear();
});

function useListAndInvalidate() {
	return {list: useSnapshots(7, 1, 20), invalidate: useInvalidateSnapshots(7)};
}

describe('useInvalidateSnapshots', () => {
	it('re-reads the list when invalidated during the first, still in-flight load', async () => {
		let answerFirst!: (v: any) => void;
		listGet.mockImplementationOnce(() => new Promise(r => (answerFirst = r)));
		listGet.mockResolvedValueOnce(page(['old', 'new']));

		const {result} = renderHook(useListAndInvalidate, {wrapper});
		await waitFor(() => expect(listGet).toHaveBeenCalledTimes(1));

		// The mutation lands while the first GET (issued before it) is open.
		await act(async () => {
			await result.current.invalidate();
		});
		answerFirst(page(['old']));

		await waitFor(() => expect(result.current.list.data?.data?.map((s: any) => s.id)).toEqual(['old', 'new']));
		expect(listGet).toHaveBeenCalledTimes(2);
	});

	it('re-reads the list when invalidated after it has loaded', async () => {
		listGet.mockResolvedValueOnce(page(['old']));
		listGet.mockResolvedValueOnce(page(['old', 'new']));

		const {result} = renderHook(useListAndInvalidate, {wrapper});
		await waitFor(() => expect(result.current.list.data?.data).toHaveLength(1));

		await act(async () => {
			await result.current.invalidate();
		});

		await waitFor(() => expect(result.current.list.data?.data).toHaveLength(2));
		expect(listGet).toHaveBeenCalledTimes(2);
	});
});
