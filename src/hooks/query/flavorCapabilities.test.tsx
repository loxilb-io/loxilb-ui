//---------------------------------------------------------
// Fail-narrow flavor resolution (npm run test:flavor-capabilities).
//
// The capability surface must never answer broader than what is
// PROVEN: while the /version probe is pending, denied (401/403), or
// unavailable (transport/5xx), gateway-only controls stay hidden —
// a security denial must not render a fully-featured product.
//---------------------------------------------------------
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render, renderHook, screen, waitFor} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import type {IInstance} from 'types/oam';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {query_get_version} from 'connector/instance/status';
import {useInstanceCapabilities, useInstanceFlavorResolution} from 'hooks/query/flavorHook';

// vi.mock calls are hoisted above every import at runtime.
vi.mock('connector/instance/status', () => ({
	query_get_version: vi.fn(),
}));
vi.mock('hooks/instanceHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/instanceHook')>();
	return {...mod, useInstanceFromURL: () => INSTANCE};
});

const INSTANCE = {id: 'i-1', name: 'inst-1'} as unknown as IInstance;
const probe = vi.mocked(query_get_version);

// Gateway-only anchors (from the generated capability map). hasMethod
// answers method-level divergence on SHARED paths (whole gateway-only path
// families are hasFeature's job), so the method anchor is the LB merge-PATCH
// that upstream loxilb 405s.
const GW_FEATURE = 'ai' as const;
const GW_METHOD = ['patch', '/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}'] as const;

let client: QueryClient;
function wrapper({children}: {children: React.ReactNode}) {
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
	client = new QueryClient();
	probe.mockReset();
});
afterEach(() => {
	cleanup();
	client.clear();
});

describe('capability surface while unresolved (fail-narrow)', () => {
	it('1. pending probe answers NARROW: gateway-only feature/method are false', () => {
		probe.mockReturnValue(new Promise(() => {})); // never resolves
		const {result} = renderHook(() => useInstanceCapabilities(), {wrapper});
		expect(result.current.resolved).toBe(false);
		expect(result.current.hasFeature(GW_FEATURE)).toBe(false);
		expect(result.current.hasMethod(...GW_METHOD)).toBe(false);
	});
});

describe('resolution state model', () => {
	it('2. 401 → denied with httpStatus, capabilities narrow and stable', async () => {
		probe.mockRejectedValue(new ApiError('denied', 401));
		const {result} = renderHook(
			() => ({res: useInstanceFlavorResolution(INSTANCE), caps: useInstanceCapabilities()}),
			{wrapper},
		);
		await waitFor(() => expect(result.current.res.state).toBe('denied'));
		expect(result.current.res).toEqual({state: 'denied', httpStatus: 401});
		expect(result.current.caps.hasFeature(GW_FEATURE)).toBe(false);
		// stays narrow — no later broadening without data
		await new Promise(r => setTimeout(r, 50));
		expect(result.current.caps.hasFeature(GW_FEATURE)).toBe(false);
		// auth failures must not be retried (no lockout pressure)
		expect(probe).toHaveBeenCalledTimes(1);
	});

	it('3. 403 → denied, distinct status', async () => {
		probe.mockRejectedValue(new ApiError('forbidden', 403));
		const {result} = renderHook(() => useInstanceFlavorResolution(INSTANCE), {wrapper});
		await waitFor(() => expect(result.current.state).toBe('denied'));
		expect(result.current).toEqual({state: 'denied', httpStatus: 403});
	});

	it('4. transport failure → unavailable, narrow', async () => {
		probe.mockRejectedValue(new TypeError('Failed to fetch'));
		const {result} = renderHook(
			() => ({res: useInstanceFlavorResolution(INSTANCE), caps: useInstanceCapabilities()}),
			{wrapper},
		);
		await waitFor(() => expect(result.current.res.state).toBe('unavailable'), {timeout: 15000});
		expect(result.current.caps.hasFeature(GW_FEATURE)).toBe(false);
	}, 20000);

	it('5. resolves loxilb → narrow; resolves gateway → full set, no reload', async () => {
		const reload = vi.fn();
		vi.stubGlobal('location', {...window.location, reload});

		probe.mockResolvedValue({});
		const narrow = renderHook(
			() => ({res: useInstanceFlavorResolution(INSTANCE), caps: useInstanceCapabilities()}),
			{wrapper},
		);
		await waitFor(() => expect(narrow.result.current.res.state).toBe('resolved'));
		expect(narrow.result.current.res).toEqual({state: 'resolved', flavor: 'loxilb'});
		expect(narrow.result.current.caps.hasFeature(GW_FEATURE)).toBe(false);
		narrow.unmount();
		client.clear();

		probe.mockResolvedValue({product: 'loxilb-inference-gateway'});
		const full = renderHook(
			() => ({res: useInstanceFlavorResolution(INSTANCE), caps: useInstanceCapabilities()}),
			{wrapper},
		);
		await waitFor(() => expect(full.result.current.res.state).toBe('resolved'));
		expect(full.result.current.res).toEqual({state: 'resolved', flavor: 'inference-gateway'});
		expect(full.result.current.caps.hasFeature(GW_FEATURE)).toBe(true);
		expect(full.result.current.caps.hasMethod(...GW_METHOD)).toBe(true);
		expect(reload).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it('6. retry recovery: one transport failure, then resolves', async () => {
		probe
			.mockRejectedValueOnce(new TypeError('Failed to fetch'))
			.mockResolvedValue({product: 'loxilb-inference-gateway'});
		const {result} = renderHook(() => useInstanceFlavorResolution(INSTANCE), {wrapper});
		await waitFor(() => expect(result.current.state).toBe('resolved'), {timeout: 15000});
		expect(result.current).toEqual({state: 'resolved', flavor: 'inference-gateway'});
	}, 20000);
});

describe('route guard on non-resolved states', () => {
	it('8. direct navigation to a gateway-only route while denied renders the denied state, not the page', async () => {
		probe.mockRejectedValue(new ApiError('denied', 403));
		const {MemoryRouter} = await import('react-router-dom');
		const {RequireFeature} = await import('components/layout/RouteGuards');
		render(
			<MemoryRouter>
				<RequireFeature feature={GW_FEATURE}>
					<div data-testid="gateway-only-page" />
				</RequireFeature>
			</MemoryRouter>,
			{wrapper},
		);
		await waitFor(() => expect(screen.queryByTestId('flavor-denied')).not.toBeNull());
		expect(screen.queryByTestId('gateway-only-page')).toBeNull();
	});

	it('8b. unavailable renders its own state, distinct from denied', async () => {
		probe.mockRejectedValue(new TypeError('Failed to fetch'));
		const {MemoryRouter} = await import('react-router-dom');
		const {RequireFeature} = await import('components/layout/RouteGuards');
		render(
			<MemoryRouter>
				<RequireFeature feature={GW_FEATURE}>
					<div data-testid="gateway-only-page" />
				</RequireFeature>
			</MemoryRouter>,
			{wrapper},
		);
		await waitFor(() => expect(screen.queryByTestId('flavor-unavailable')).not.toBeNull(), {timeout: 15000});
		expect(screen.queryByTestId('gateway-only-page')).toBeNull();
		expect(screen.queryByTestId('flavor-denied')).toBeNull();
	}, 20000);
});

describe('no transient flash of gateway-only controls', () => {
	function GatedButton() {
		const caps = useInstanceCapabilities();
		if (!caps.hasFeature(GW_FEATURE)) return null;
		return <button type="button">gateway-only-write</button>;
	}

	it('7. a gated control never mounts between first render and a loxilb resolution', async () => {
		let resolveProbe!: (v: object) => void;
		probe.mockReturnValue(new Promise(r => (resolveProbe = r)) as never);
		render(<GatedButton />, {wrapper});
		expect(screen.queryByRole('button', {name: 'gateway-only-write'})).toBeNull();
		resolveProbe({}); // → loxilb
		await new Promise(r => setTimeout(r, 100));
		expect(screen.queryByRole('button', {name: 'gateway-only-write'})).toBeNull();
	});
});
