//---------------------------------------------------------
// useMetricsSnapshot — the history ends with the snapshot it is returned with
//---------------------------------------------------------
// The retention ring is written by an effect, after the render that delivers
// a snapshot, and a ref write re-renders nothing. Returning the ring as it
// stood made every reader of history[last] one observation behind `snapshot`
// and empty until the next refetch: the QoS signal panels said "No data" for
// a whole cadence beside a freshness badge that said a snapshot had arrived.
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {query_get_metrics_snapshot} from 'connector/instance/observability';
import {IMetricsSnapshot} from 'types/observability';
import {IInstance} from 'types/oam';
import {SNAPSHOT_RETENTION, useMetricsSnapshot} from './observabilityHooks';

vi.mock('connector/instance/observability', () => ({query_get_metrics_snapshot: vi.fn()}));
vi.mock('./flavorHook', () => ({useInstanceFlavor: () => ({flavor: 'inference-gateway'})}));

const INST = {id: 3, name: 'gw'} as unknown as IInstance;
const read = vi.mocked(query_get_metrics_snapshot);

function observation(receivedAtMs: number): IMetricsSnapshot {
	return {instanceId: 3, flavor: 'inference-gateway', receivedAtMs, available: true, families: new Map(), diagnostics: {} as IMetricsSnapshot['diagnostics']};
}

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// Every render the hook produced, as the consumer saw it.
function renderRecorded() {
	const renders: {snapshot: IMetricsSnapshot | undefined; history: readonly IMetricsSnapshot[]}[] = [];
	const hook = renderHook(() => {
		const value = useMetricsSnapshot(INST);
		renders.push({snapshot: value.snapshot, history: value.history});
		return value;
	}, {wrapper});
	return {...hook, renders};
}

let clock = 1_000;
beforeEach(() => {
	client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	read.mockReset();
	read.mockImplementation(async () => observation((clock += 10_000)));
});
afterEach(() => {
	cleanup();
	client.clear();
});

describe('useMetricsSnapshot history', () => {
	it('ends with the snapshot on the very render that delivers it', async () => {
		const {result, renders} = renderRecorded();
		await waitFor(() => expect(result.current.snapshot).toBeDefined());

		const delivering = renders.filter(r => r.snapshot !== undefined);
		expect(delivering.length).toBeGreaterThan(0);
		for (const r of delivering) expect(r.history[r.history.length - 1]).toBe(r.snapshot);
		expect(renders.filter(r => r.snapshot === undefined).every(r => r.history.length === 0)).toBe(true);
	});

	it('keeps the previous observation before the new one, so rates can diff the last two', async () => {
		const {result, renders} = renderRecorded();
		await waitFor(() => expect(result.current.snapshot).toBeDefined());
		const first = result.current.snapshot!;

		await act(async () => result.current.refetch());
		await waitFor(() => expect(result.current.snapshot).not.toBe(first));
		const second = result.current.snapshot!;

		expect(result.current.history).toEqual([first, second]);
		for (const r of renders.filter(r => r.snapshot === second)) expect(r.history).toEqual([first, second]);
	});

	it('does not record one observation twice across re-renders', async () => {
		const {result, rerender} = renderRecorded();
		await waitFor(() => expect(result.current.snapshot).toBeDefined());
		rerender();
		rerender();
		expect(result.current.history).toHaveLength(1);
		expect(result.current.history[0]).toBe(result.current.snapshot);
	});

	it('retains at most the configured number of observations', async () => {
		const {result} = renderRecorded();
		await waitFor(() => expect(result.current.snapshot).toBeDefined());
		for (let i = 0; i < SNAPSHOT_RETENTION + 2; i++) {
			const before = result.current.snapshot;
			await act(async () => result.current.refetch());
			await waitFor(() => expect(result.current.snapshot).not.toBe(before));
		}
		expect(result.current.history).toHaveLength(SNAPSHOT_RETENTION);
		expect(result.current.history[SNAPSHOT_RETENTION - 1]).toBe(result.current.snapshot);
	});
});
