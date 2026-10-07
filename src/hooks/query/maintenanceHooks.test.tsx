//---------------------------------------------------------
// Maintenance read — request discipline.
//
// /maintenance is a gateway-only path. No request may leave for an instance
// that has not resolved to the gateway: a pending or denied probe answers
// narrow, and a plain loxilb is never asked.
//---------------------------------------------------------
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, renderHook, waitFor} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {GET_INST} from 'connector/fetcher/fetcher_inst';
import {query_get_version} from 'connector/instance/status';
import type {IInstance} from 'types/oam';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useMaintenance} from './maintenanceHooks';

vi.mock('connector/instance/status', () => ({query_get_version: vi.fn()}));
vi.mock('connector/fetcher/fetcher_inst', () => ({GET_INST: vi.fn(), PUT_INST: vi.fn()}));

const INSTANCE = {id: 42, name: 'inst-42'} as unknown as IInstance;
const probe = vi.mocked(query_get_version);
const restGet = vi.mocked(GET_INST);

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const settle = () => new Promise(r => setTimeout(r, 50));

beforeEach(() => {
	client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	probe.mockReset();
	restGet.mockReset();
	restGet.mockResolvedValue({code: 200, data: {state: 'active'}, message: ''});
});
afterEach(() => {
	cleanup();
	client.clear();
});

describe('useMaintenance', () => {
	it('sends nothing while the flavor probe is pending', async () => {
		probe.mockReturnValue(new Promise(() => {}));
		renderHook(() => useMaintenance(INSTANCE), {wrapper});
		await settle();
		expect(restGet).not.toHaveBeenCalled();
	});

	it('sends nothing when the probe is denied', async () => {
		probe.mockRejectedValue(new ApiError('denied', 401));
		renderHook(() => useMaintenance(INSTANCE), {wrapper});
		await settle();
		expect(restGet).not.toHaveBeenCalled();
	});

	it('never asks a plain loxilb', async () => {
		probe.mockResolvedValue({version: '0.9.8'} as never);
		renderHook(() => useMaintenance(INSTANCE), {wrapper});
		await settle();
		expect(restGet).not.toHaveBeenCalled();
	});

	it('reads the gateway once it is proven to be one', async () => {
		probe.mockResolvedValue({version: '0.9.8', product: 'loxilb-inference-gateway'} as never);
		const {result} = renderHook(() => useMaintenance(INSTANCE), {wrapper});
		await waitFor(() => expect(result.current.data?.data.state).toBe('active'));
		expect(restGet).toHaveBeenCalledWith(INSTANCE, '/maintenance');
	});

	it('sends nothing without an instance', async () => {
		probe.mockResolvedValue({version: '0.9.8', product: 'loxilb-inference-gateway'} as never);
		renderHook(() => useMaintenance(null), {wrapper});
		await settle();
		expect(restGet).not.toHaveBeenCalled();
	});
});
