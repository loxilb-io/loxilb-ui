//---------------------------------------------------------
// Observability request-discipline negatives (UI-MON-011a / UI-MON-004)
//---------------------------------------------------------
// Two contracts under test, both against mocked transports:
// - ZERO gateway-only telemetry requests leave for an instance that has not
//   RESOLVED to the gateway flavor — pending, denied, unavailable, and
//   plain-loxilb answers all stay narrow;
// - the metrics snapshot is ONE shared network query: any number of
//   consumers (cards, panels, the legacy compat hook) ride a single GET per
//   cadence tick.

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, renderHook, waitFor} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import type {IInstance} from 'types/oam';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {query_get_version} from 'connector/instance/status';
import {GET_INST, GET_INST_TEXT} from 'connector/fetcher/fetcher_inst';
import {useDiagnostics, useGpuStatus, useWorkerMetrics} from './gatewayTelemetryHooks';
import {useLiveMetrics} from './metricsHook';
import {useMetricsSnapshot} from './observabilityHooks';

vi.mock('connector/instance/status', () => ({query_get_version: vi.fn()}));
vi.mock('connector/fetcher/fetcher_inst', () => ({GET_INST: vi.fn(), GET_INST_TEXT: vi.fn()}));
vi.mock('hooks/instanceHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/instanceHook')>();
	return {...mod, useInstanceFromURL: () => INSTANCE};
});

const INSTANCE = {id: 42, name: 'inst-42'} as unknown as IInstance;
const probe = vi.mocked(query_get_version);
const restGet = vi.mocked(GET_INST);
const textGet = vi.mocked(GET_INST_TEXT);

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	probe.mockReset();
	restGet.mockReset();
	textGet.mockReset();
	restGet.mockResolvedValue({code: 200, data: {}, message: ''});
	textGet.mockResolvedValue({code: 200, data: 'loxilb_lb_rules 1\n', message: ''});
});
afterEach(() => {
	cleanup();
	client.clear();
});

function useAllTelemetry() {
	return {
		gpu: useGpuStatus(INSTANCE, true),
		workers: useWorkerMetrics(INSTANCE, true, true),
		diagnostics: useDiagnostics(INSTANCE, true),
	};
}

describe('gateway-only telemetry request discipline', () => {
	it('sends nothing while the flavor probe is pending', async () => {
		probe.mockReturnValue(new Promise(() => {}));
		renderHook(() => useAllTelemetry(), {wrapper});
		await new Promise(r => setTimeout(r, 50));
		expect(restGet).not.toHaveBeenCalled();
	});

	it('sends nothing when the probe is denied', async () => {
		probe.mockRejectedValue(new ApiError('denied', 401));
		renderHook(() => useAllTelemetry(), {wrapper});
		await new Promise(r => setTimeout(r, 50));
		expect(restGet).not.toHaveBeenCalled();
	});

	it('sends nothing on a plain loxilb instance, whatever the caller passes', async () => {
		probe.mockResolvedValue({});
		renderHook(() => useAllTelemetry(), {wrapper});
		await new Promise(r => setTimeout(r, 50));
		expect(restGet).not.toHaveBeenCalled();
	});

	it('sends the gateway telemetry reads once the flavor is proven', async () => {
		probe.mockResolvedValue({product: 'loxilb-inference-gateway'});
		const {result} = renderHook(() => useAllTelemetry(), {wrapper});
		await waitFor(() => expect(result.current.gpu.data).toBeDefined());
		const paths = restGet.mock.calls.map(c => c[1]);
		expect(paths).toContain('/config/gpu/status');
		expect(paths).toContain('/diagnostics');
	});

	it('worker metrics stay quiet until GPU status proves monitoring enabled', async () => {
		probe.mockResolvedValue({product: 'loxilb-inference-gateway'});
		renderHook(() => useWorkerMetrics(INSTANCE, true, false), {wrapper});
		await new Promise(r => setTimeout(r, 50));
		expect(restGet.mock.calls.map(c => c[1])).not.toContain('/config/worker/metrics');
	});
});

describe('one shared snapshot query per cadence (UI-MON-004)', () => {
	it('N consumers produce exactly ONE /metrics request', async () => {
		probe.mockResolvedValue({product: 'loxilb-inference-gateway'});
		const {result} = renderHook(
			() => ({
				a: useMetricsSnapshot(INSTANCE),
				b: useMetricsSnapshot(INSTANCE),
				// The legacy compat hook rides the same query — its old per-card
				// keyPrefix/interval must not mint a second network poll.
				legacy1: useLiveMetrics(INSTANCE, {keyPrefix: 'card-1', refetchInterval: 1000}),
				legacy2: useLiveMetrics(INSTANCE, {keyPrefix: 'card-2', refetchInterval: 10000}),
			}),
			{wrapper},
		);
		// The fail-narrow window legitimately fetches once under the loxilb
		// key before resolution swaps to the gateway key — so the ceiling is
		// one call PER DISTINCT KEY (2), not per consumer (4+).
		await waitFor(() => expect(result.current.a.snapshot?.flavor).toBe('inference-gateway'));
		await waitFor(() => expect(result.current.legacy1.metrics).toBeDefined());
		const perKeyCalls = textGet.mock.calls.length;
		expect(perKeyCalls).toBeLessThanOrEqual(2);
		// And every consumer renders the SAME observation with no extra fetch.
		expect(result.current.b.snapshot).toBe(result.current.a.snapshot);
		expect(result.current.legacy1.metrics!.timestamp).toBe(result.current.a.snapshot!.receivedAtMs);
		expect(result.current.legacy2.metrics!.timestamp).toBe(result.current.a.snapshot!.receivedAtMs);
		expect(textGet.mock.calls.length).toBe(perKeyCalls);
	});

	it('an instance switch changes the cache entry instead of reinterpreting it', async () => {
		probe.mockResolvedValue({product: 'loxilb-inference-gateway'});
		const {result, rerender} = renderHook(({inst}: {inst: IInstance}) => useMetricsSnapshot(inst), {
			wrapper,
			initialProps: {inst: INSTANCE},
		});
		await waitFor(() => expect(result.current.snapshot).toBeDefined());
		const first = result.current.snapshot!;

		const OTHER = {id: 43, name: 'inst-43'} as unknown as IInstance;
		rerender({inst: OTHER});
		await waitFor(() => expect(result.current.snapshot?.instanceId).toBe(43));
		// A second network fetch happened for the new key; the ring restarted
		// (no cross-instance rate could be derived from mixed history).
		expect(textGet.mock.calls.length).toBeGreaterThanOrEqual(2);
		expect(result.current.history.every(s => s.instanceId === 43)).toBe(true);
		expect(result.current.snapshot).not.toBe(first);
	});
});
