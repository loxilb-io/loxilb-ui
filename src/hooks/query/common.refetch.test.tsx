//---------------------------------------------------------
// Instance-data refetch after a write, during the first load
//---------------------------------------------------------
// Every table page enables Add while its list is still loading, then calls
// refetch() once the create confirms. React Query answers a refetch during a
// query's FIRST load with the fetch already in flight — issued before the
// write — so the new row never appeared. refetch() must start a fresh read.

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import type {IInstance} from 'types/oam';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fromQueryRefetch} from './reconcile';
import {useQueryInstanceData} from './common';

const INSTANCE = {id: 3, name: 'inst-3'} as unknown as IInstance;
const listGet = vi.fn<(inst: IInstance) => Promise<string[]>>();

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	listGet.mockReset();
});
afterEach(() => {
	cleanup();
	client.clear();
});

// Read the way a page does: destructured in render, which is what tells
// React Query which fields to re-render on.
function useRules() {
	const {data, refetch} = useQueryInstanceData(['rules'], listGet, INSTANCE);
	return {data, refetch};
}

describe('useQueryInstanceData refetch', () => {
	it('re-reads when refetched during the first, still in-flight load', async () => {
		let answerFirst!: (v: string[]) => void;
		listGet.mockImplementationOnce(() => new Promise(r => (answerFirst = r)));
		listGet.mockResolvedValueOnce(['old', 'new']);

		const {result} = renderHook(useRules, {wrapper});
		await waitFor(() => expect(listGet).toHaveBeenCalledTimes(1));

		// The create confirmed while the first GET (issued before it) is open.
		let refetched: string[] | undefined;
		await act(async () => {
			const pending = result.current.refetch();
			answerFirst(['old']);
			refetched = (await pending).data;
		});

		expect(refetched).toEqual(['old', 'new']);
		await waitFor(() => expect(result.current.data).toEqual(['old', 'new']));
		expect(listGet).toHaveBeenCalledTimes(2);
	});

	it('the reconciler read sees the write too', async () => {
		let answerFirst!: (v: string[]) => void;
		listGet.mockImplementationOnce(() => new Promise(r => (answerFirst = r)));
		listGet.mockResolvedValueOnce(['old', 'new']);

		const {result} = renderHook(useRules, {wrapper});
		await waitFor(() => expect(listGet).toHaveBeenCalledTimes(1));

		let read: string[] | undefined;
		await act(async () => {
			const pending = fromQueryRefetch(result.current.refetch)();
			answerFirst(['old']);
			read = await pending;
		});
		expect(read).toEqual(['old', 'new']);
	});

	it('refetches once, without cancelling, when the list has loaded', async () => {
		listGet.mockResolvedValueOnce(['old']);
		listGet.mockResolvedValueOnce(['old', 'new']);

		const {result} = renderHook(useRules, {wrapper});
		await waitFor(() => expect(result.current.data).toEqual(['old']));

		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.data).toEqual(['old', 'new']));
		expect(listGet).toHaveBeenCalledTimes(2);
	});

	it('keeps refetch stable across renders, as pages list it in effect deps', async () => {
		listGet.mockResolvedValue(['old']);
		const {result, rerender} = renderHook(useRules, {wrapper});
		const first = result.current.refetch;
		await waitFor(() => expect(result.current.data).toEqual(['old']));
		rerender();
		expect(result.current.refetch).toBe(first);
	});
});
