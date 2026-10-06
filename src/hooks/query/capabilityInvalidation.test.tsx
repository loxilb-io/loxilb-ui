//---------------------------------------------------------
// The capability read's invalidation prefix matches its real key
//---------------------------------------------------------
// The LB page invalidates the capability read after every LB write, because
// the source-check slot budget moves with each create and delete. The key is
// built by useQueryInstanceData, which appends the instance id AGAIN, so a
// prefix written by hand elsewhere would silently match nothing and a second
// create would be judged against a slot that is already gone.

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, renderHook, waitFor} from '@testing-library/react';
import type {IInstance} from 'types/oam';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {query_get_capability_status} from 'connector/instance/status';
import {capabilityQueryPrefix, useGatewayCapabilities} from './statusHook';

vi.mock('connector/instance/status', () => ({
	query_get_capability_status: vi.fn(async () => []),
	query_get_audit_rest: vi.fn(),
	query_get_device_status: vi.fn(),
	query_get_filesystem_status: vi.fn(),
	query_get_process_status: vi.fn(),
	query_get_log_level: vi.fn(),
}));

const INST_1 = {id: 1, name: 'gw-1'} as unknown as IInstance;
const INST_2 = {id: 2, name: 'gw-2'} as unknown as IInstance;

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	client = new QueryClient({defaultOptions: {queries: {retry: false}}});
});
afterEach(() => {
	cleanup();
	client.clear();
});

describe('capabilityQueryPrefix', () => {
	it('matches the capability read of that instance and of no other', async () => {
		const {result} = renderHook(() => [useGatewayCapabilities(INST_1).isSuccess, useGatewayCapabilities(INST_2).isSuccess], {wrapper});
		await waitFor(() => expect(result.current).toEqual([true, true]));

		const matched = client.getQueryCache().findAll({queryKey: capabilityQueryPrefix(INST_1)});
		expect(matched.map(q => q.queryKey)).toEqual([['status', 'capabilities', '1', '1']]);
	});

	it('invalidating it marks the read stale so the next open re-asks', async () => {
		const {result} = renderHook(() => useGatewayCapabilities(INST_1), {wrapper});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		await client.invalidateQueries({queryKey: capabilityQueryPrefix(INST_1), refetchType: 'none'});
		expect(client.getQueryState(['status', 'capabilities', '1', '1'])?.isInvalidated).toBe(true);
	});
});

describe('the model-specific capability read', () => {
	const keys = () => client.getQueryCache().getAll().map(q => q.queryKey);

	it('lives under its own key and leaves the model-independent key where it was', async () => {
		const {result} = renderHook(() => [useGatewayCapabilities(INST_1).isSuccess, useGatewayCapabilities(INST_1, 'org/model').isSuccess], {wrapper});
		await waitFor(() => expect(result.current).toEqual([true, true]));

		// Pinned literally: an entry that moves is an entry no existing
		// invalidation reaches.
		expect(keys()).toEqual([
			['status', 'capabilities', '1', '1'],
			['status', 'capabilities', '1', 'model', 'org/model', '1'],
		]);
	});

	it.each([undefined, ''])('a missing model name (%j) is the model-independent read', async name => {
		const {result} = renderHook(() => useGatewayCapabilities(INST_1, name), {wrapper});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(keys()).toEqual([['status', 'capabilities', '1', '1']]);
		expect(vi.mocked(query_get_capability_status).mock.lastCall?.[1]).toBeUndefined();
	});

	it('asks the connector about that model', async () => {
		const {result} = renderHook(() => useGatewayCapabilities(INST_1, 'org/model'), {wrapper});
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(vi.mocked(query_get_capability_status).mock.lastCall).toEqual([INST_1, {modelName: 'org/model'}]);
	});

	it('keeps one entry per model, so an answer cannot land on another name', async () => {
		const {result} = renderHook(() => [useGatewayCapabilities(INST_1, 'org/a').isSuccess, useGatewayCapabilities(INST_1, 'org/b').isSuccess], {wrapper});
		await waitFor(() => expect(result.current).toEqual([true, true]));
		expect(keys()).toEqual([
			['status', 'capabilities', '1', 'model', 'org/a', '1'],
			['status', 'capabilities', '1', 'model', 'org/b', '1'],
		]);
	});

	it('is covered by the same invalidation prefix, for that instance only', async () => {
		const {result} = renderHook(
			() => [useGatewayCapabilities(INST_1, 'org/model').isSuccess, useGatewayCapabilities(INST_2, 'org/model').isSuccess],
			{wrapper},
		);
		await waitFor(() => expect(result.current).toEqual([true, true]));

		await client.invalidateQueries({queryKey: capabilityQueryPrefix(INST_1), refetchType: 'none'});
		expect(client.getQueryState(['status', 'capabilities', '1', 'model', 'org/model', '1'])?.isInvalidated).toBe(true);
		expect(client.getQueryState(['status', 'capabilities', '2', 'model', 'org/model', '2'])?.isInvalidated).toBe(false);
	});
});
