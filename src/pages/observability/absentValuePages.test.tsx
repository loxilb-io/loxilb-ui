//---------------------------------------------------------
// Observability pages — absent is not zero, omitted is not unknown
//---------------------------------------------------------
// The page-level half of GatewaySummaryCards.test.tsx: the same three values
// are rendered again on their own pages, and a fix to the card alone would
// leave the page telling the operator the opposite.
//   - PdKv "Enforcement faults" counted the series of a family the gateway
//     never exported and printed 0 ("measured, none faulted");
//   - Workers "Workers tracked" printed N/A for `worker_count`, which the
//     gateway omits (omitempty) precisely when it is 0;
//   - Persistence "Auto-persist failures (reported)" printed N/A for
//     `auto_persist`, which /diagnostics only sends while failures > 0.

import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from 'observability/parser';
import PdKvPage from './PdKvPage';
import PersistencePage from './PersistencePage';
import WorkersPage from './WorkersPage';

const state = vi.hoisted(() => ({
	history: [] as IMetricsSnapshot[],
	gpu: undefined as unknown,
	workers: undefined as unknown,
	diagnostics: undefined as unknown,
}));

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => ({id: 1, name: 'gw'}),
}));

vi.mock('hooks/query/flavorHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/flavorHook')>();
	return {
		...mod,
		useInstanceCapabilities: () => ({
			flavor: 'inference-gateway',
			resolved: true,
			resolution: {state: 'resolved', flavor: 'inference-gateway'},
			hasFeature: () => true,
			hasField: () => true,
			hasMethod: () => true,
			allowedEnum: <T,>(_c: string, v: T[]) => v,
		}),
	};
});

vi.mock('hooks/query/observabilityHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/observabilityHooks')>();
	return {
		...mod,
		useObservabilityCadence: () => [10_000, () => undefined],
		useMetricsSnapshot: () => ({
			snapshot: state.history[state.history.length - 1],
			history: state.history,
			isLoading: false,
			flavor: 'inference-gateway' as const,
			cadenceMs: 10_000 as const,
			refetch: () => undefined,
		}),
	};
});

vi.mock('hooks/query/gatewayTelemetryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/gatewayTelemetryHooks')>();
	return {
		...mod,
		useGpuStatus: () => ({data: state.gpu, isLoading: false, error: null, refetch: () => undefined}),
		useWorkerMetrics: () => ({data: state.workers, isLoading: false, error: null, refetch: () => undefined}),
		useDiagnostics: () => ({data: state.diagnostics, isLoading: false, error: null, refetch: () => undefined}),
	};
});

vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {...mod, useLoadBalancerConfig: () => ({data: [], refetch: () => undefined})};
});

const T0 = 1_000_000;

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

// StatRow renders label and value as siblings; assert the value cell alone,
// so "0" cannot be satisfied by a digit somewhere in the label.
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

function renderPage(page: JSX.Element) {
	render(<MemoryRouter>{page}</MemoryRouter>);
}

afterEach(() => {
	cleanup();
	state.history = [];
	state.gpu = undefined;
	state.workers = undefined;
	state.diagnostics = undefined;
});

describe('PdKvPage — enforcement faults', () => {
	it('does not count faults for a family the gateway never exported', () => {
		// No strict KV-exact rule → the fault family is absent entirely.
		state.history = [snapshotOf('loxilb_pd_sessions_active 0', T0)];
		renderPage(<PdKvPage />);
		expect(valueOf('Enforcement faults')).toBe('None reported');
	});

	it('counts the faulted rules when the family is exported, including a true zero', () => {
		const faults = (a: number, b: number) =>
			snapshotOf([`loxilb_ai_kv_enforcement_fault{rule="a"} ${a}`, `loxilb_ai_kv_enforcement_fault{rule="b"} ${b}`].join('\n'), T0);
		state.history = [faults(1, 0)];
		renderPage(<PdKvPage />);
		expect(valueOf('Enforcement faults')).toBe('1');
		cleanup();

		state.history = [faults(0, 0)];
		renderPage(<PdKvPage />);
		expect(valueOf('Enforcement faults')).toBe('0');
	});
});

describe('WorkersPage — omitempty worker_count', () => {
	const gpu = (data: Record<string, unknown>) => ({receivedAtMs: T0, data: {enabled: true, routing_mode: 'gpu_aware', ...data}});

	it('reads an omitted worker_count as 0, not N/A', () => {
		state.gpu = gpu({});
		renderPage(<WorkersPage />);
		expect(valueOf('Workers tracked')).toBe('0');
	});

	it('shows the stated count when the gateway sends one', () => {
		state.gpu = gpu({worker_count: 3});
		renderPage(<WorkersPage />);
		expect(valueOf('Workers tracked')).toBe('3');
	});
});

// swapped_requests is caller-supplied: the gateway stores what the reporter
// sent and neither computes nor verifies a delta, so the column cannot claim one.
describe('WorkersPage — preemptions are as reported', () => {
	it('does not label a caller-supplied value a delta', () => {
		state.gpu = {receivedAtMs: T0, data: {enabled: true, routing_mode: 'gpu_aware', worker_count: 1}};
		state.workers = {receivedAtMs: T0, data: [{endpoint_ip: '10.0.0.1', queued_requests: 2, swapped_requests: 7, kv_cache_usage_perc: 40}]};
		renderPage(<WorkersPage />);
		expect(screen.getByText('Preemptions (as reported)')).toBeTruthy();
		expect(screen.queryByText(/delta/i)).toBeNull();
	});
});

describe('PersistencePage — auto_persist sent only while failing', () => {
	const diagnostics = (data: Record<string, unknown>) => ({receivedAtMs: T0, data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', ...data}});

	it('reads an omitted auto_persist as zero failures, not N/A', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		state.diagnostics = diagnostics({});
		renderPage(<PersistencePage />);
		expect(valueOf('Auto-persist failures (reported)')).toBe('0');
	});

	it('shows the failure count while the gateway reports one', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		state.diagnostics = diagnostics({auto_persist: {consecutive_failures: 4, last_error: 'disk full'}});
		renderPage(<PersistencePage />);
		expect(valueOf('Auto-persist failures (reported)')).toBe('4');
		expect(valueOf('Auto-persist last error')).toBe('disk full');
	});
});

// `succeeded` is set only for a fully applied snapshot restore. With no
// snapshot found nothing was restored and nothing failed, yet the row read
// "Boot restore succeeded: No".
describe('PersistencePage — boot with no snapshot', () => {
	const boot = (b: Record<string, unknown>) => ({receivedAtMs: T0, data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', boot: {profile: 'strict', legacy_fallback: false, degraded: false, ...b}}});

	it('says there was nothing to restore instead of reporting a failure', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		state.diagnostics = boot({snapshot_found: false, succeeded: false});
		renderPage(<PersistencePage />);
		expect(valueOf('Boot restore succeeded')).toBe('Nothing to restore');
	});

	it('still reports a failed restore of a snapshot that was found', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		state.diagnostics = boot({snapshot_found: true, succeeded: false, degraded: true});
		renderPage(<PersistencePage />);
		expect(valueOf('Boot restore succeeded')).toBe('No');
	});
});

// loxilb_pd_kv_blocks is "KV cache blocks currently stored": occupancy. Titled
// "capacity", a live 4 read as a tiny cache limit.
describe('PdKvPage — KV blocks are occupancy', () => {
	it('does not call blocks stored a capacity', () => {
		state.history = [snapshotOf('loxilb_pd_kv_blocks{service="s",ep_idx="0"} 4', T0)];
		renderPage(<PdKvPage />);
		expect(screen.getByText('KV blocks stored by endpoint (strict join)')).toBeTruthy();
		expect(screen.queryByText(/capacity/i)).toBeNull();
	});
});
