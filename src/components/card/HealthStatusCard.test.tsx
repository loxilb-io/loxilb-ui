//---------------------------------------------------------
// Endpoint Health card — what the percentage measures
//---------------------------------------------------------
// On the gateway, a host whose health probe is not active reports ok unless
// forced down (the healthy-endpoints gauge's own HELP), so "100% Excellent"
// can be asserted about hosts nothing probed. loxilb documents no such rule,
// so the caveat is keyed on the flavor, not shown everywhere.
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import HealthStatusCard from './HealthStatusCard';

const state = vi.hoisted(() => ({metrics: undefined as any, flavor: undefined as 'loxilb' | 'inference-gateway' | undefined}));

vi.mock('hooks/query/metricsHook', () => ({
	useLiveMetrics: () => ({metrics: state.metrics, isLoading: false, failure: undefined, cadenceMs: 10_000, refetch: vi.fn()}),
}));

vi.mock('hooks/query/flavorHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/flavorHook')>();
	return {...mod, useInstanceFlavor: () => ({flavor: state.flavor, resolved: state.flavor !== undefined})};
});

const INSTANCE = {id: 1, name: 'gw'} as any;
const CAVEAT = 'Hosts without an active health probe count as healthy.';
const metrics = (healthy: number, unhealthy: number) => {
	const m = {loxilb_healthy_endpoints: healthy, loxilb_unhealthy_endpoints: unhealthy};
	return {timestamp: 1, critical: m, important: m, total_metrics: 2, available: true};
};

afterEach(() => {
	cleanup();
	state.metrics = undefined;
	state.flavor = undefined;
});

describe('HealthStatusCard — unprobed hosts', () => {
	it('says on the gateway that 100% may include hosts nothing probed', () => {
		state.metrics = metrics(7, 0);
		state.flavor = 'inference-gateway';
		render(<HealthStatusCard title="Endpoint Health" instance={INSTANCE} />);
		expect(screen.getByText('100%')).toBeTruthy();
		expect(screen.getByText(CAVEAT)).toBeTruthy();
	});

	it('adds no gateway caveat on loxilb, which documents no such rule', () => {
		state.metrics = metrics(7, 0);
		state.flavor = 'loxilb';
		render(<HealthStatusCard title="Endpoint Health" instance={INSTANCE} />);
		expect(screen.queryByText(CAVEAT)).toBeNull();
	});

	it('has nothing to qualify with no endpoints', () => {
		state.metrics = metrics(0, 0);
		state.flavor = 'inference-gateway';
		render(<HealthStatusCard title="Endpoint Health" instance={INSTANCE} />);
		expect(screen.queryByText(CAVEAT)).toBeNull();
	});
});
