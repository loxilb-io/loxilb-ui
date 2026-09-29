//---------------------------------------------------------
// Gateway summary cards — absent is not zero, omitted is not unknown
//---------------------------------------------------------
// Two opposite mistakes, both reaching an operator as a wrong number:
//   - a count or sum over a family the gateway never exported printed 0,
//     asserting "measured, nothing there";
//   - a JSON field the gateway omits BECAUSE it is zero (omitempty) printed
//     N/A, asserting "unknown" about a value that was stated.

import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from 'observability/parser';
import {GwAiEventsCard, GwKvExactCard, GwPersistenceCard, GwWorkerFreshnessCard} from './GatewaySummaryCards';

const state = vi.hoisted(() => ({
	history: [] as IMetricsSnapshot[],
	gpu: undefined as unknown,
}));

vi.mock('hooks/query/observabilityHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/observabilityHooks')>();
	return {
		...mod,
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
		useDiagnostics: () => ({data: undefined, isLoading: false, error: null, refetch: () => undefined}),
	};
});

const T0 = 1_000_000;

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

const INSTANCE = {id: 1, name: 'gw'} as never;
const rowText = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

function renderCard(card: JSX.Element) {
	render(<MemoryRouter>{card}</MemoryRouter>);
}

afterEach(() => {
	cleanup();
	state.history = [];
	state.gpu = undefined;
});

describe('GwKvExactCard — enforcement faults', () => {
	it('does not count faults for a family the gateway never exported', () => {
		// No strict KV-exact rule → the fault family is absent entirely.
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		renderCard(<GwKvExactCard instance={INSTANCE} />);
		expect(rowText('Rules with enforcement faults')).toContain('None reported');
	});

	it('counts the faulted rules when the family is exported, including a true zero', () => {
		state.history = [snapshotOf(['loxilb_ai_kv_enforcement_fault{rule="a"} 1', 'loxilb_ai_kv_enforcement_fault{rule="b"} 0'].join('\n'), T0)];
		renderCard(<GwKvExactCard instance={INSTANCE} />);
		expect(rowText('Rules with enforcement faults')).toContain('1');
	});
});

describe('GwPersistenceCard — persist errors', () => {
	it('reads a present family with no error child as a true zero', () => {
		// `{result="error"}` is a lazy child: never created = never failed.
		state.history = [snapshotOf('loxilb_persist_total{result="ok"} 4', T0)];
		renderCard(<GwPersistenceCard instance={INSTANCE} />);
		expect(rowText('Persist errors (cumulative)')).toMatch(/0$/);
	});

	it('does not claim a clean record when the family itself is absent', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		renderCard(<GwPersistenceCard instance={INSTANCE} />);
		expect(rowText('Persist errors (cumulative)')).not.toMatch(/\d/);
	});
});

describe('GwWorkerFreshnessCard — omitempty worker_count', () => {
	it('reads an omitted worker_count on an enabled monitor as 0, not N/A', () => {
		state.gpu = {data: {enabled: true, routing_mode: 'least-kv'}, receivedAtMs: T0};
		renderCard(<GwWorkerFreshnessCard instance={INSTANCE} />);
		expect(rowText('Workers tracked')).toBe('Workers tracked0');
	});

	it('shows the stated count when the gateway sends one', () => {
		state.gpu = {data: {enabled: true, routing_mode: 'least-kv', worker_count: 3}, receivedAtMs: T0};
		renderCard(<GwWorkerFreshnessCard instance={INSTANCE} />);
		expect(rowText('Workers tracked')).toBe('Workers tracked3');
	});
});

// Upstream records every token-quota refusal in BOTH rate_limit_hits and
// token_quota_denied. The card summed the two, so each one counted twice.
describe('GwAiEventsCard — denial events', () => {
	const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
	const exposition = (quota: number, rate: number) =>
		[
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="token_quota_exceeded"} ${quota}`,
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="rate_limit_exceeded"} ${rate}`,
			`loxilb_ai_token_quota_denied_total{tenant="t"} ${quota}`,
			`loxilb_ai_requests_total{model="m",tenant="t",status="200",outcome="completed"} 100`,
			`loxilb_ai_requests_total{model="m",tenant="t",status="429",outcome="denied"} ${quota + rate}`,
		].join('\n');

	it('counts each refused request once, not once per family that recorded it', () => {
		// 5 quota + 3 rate-limit refusals in 10 s = 0.8/s. The old sum read 1.3/s.
		state.history = [snapshotOf(exposition(10, 20), T0), snapshotOf(exposition(15, 23), T0 + 10_000)];
		renderCard(<GwAiEventsCard instance={INSTANCE} />);
		expect(valueOf('Denial events')).toBe('0.800/s');
	});

	it('is not hidden by a reason family that has never been written', () => {
		// model_not_allowed absent: before, one absent term replaced the whole total.
		state.history = [snapshotOf(exposition(10, 20), T0), snapshotOf(exposition(10, 20), T0 + 10_000)];
		renderCard(<GwAiEventsCard instance={INSTANCE} />);
		expect(valueOf('Denial events')).toBe('0.000/s');
	});
});

// The dashboard twin of the AI Traffic panel: "Completed SSE streams" over a
// family that also counts non-streaming answers.
describe('GwAiEventsCard — completed requests', () => {
	const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
	const exposition = (completed: number) => `loxilb_ai_requests_total{model="m",tenant="t",status="200",outcome="completed"} ${completed}`;

	it('labels the completed rate as requests, not SSE streams', () => {
		state.history = [snapshotOf(exposition(100), T0), snapshotOf(exposition(150), T0 + 10_000)];
		renderCard(<GwAiEventsCard instance={INSTANCE} />);
		expect(valueOf('Completed requests')).toBe('5.0/s');
		expect(screen.queryByText(/SSE stream/)).toBeNull();
	});
});
