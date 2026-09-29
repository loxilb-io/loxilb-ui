//---------------------------------------------------------
// Security page — AI security events by reason
//---------------------------------------------------------
// rate_limit_hits_total carries token-quota refusals beside the request-rate
// buckets, and the per-reason rows put "Rate limited" in front of every one
// of them: "Rate limited (token_quota_exceeded)" names the wrong gate.

import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from 'observability/parser';
import SecurityPage from './SecurityPage';

const metrics = vi.hoisted(() => ({history: [] as IMetricsSnapshot[]}));

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
			snapshot: metrics.history[metrics.history.length - 1],
			history: metrics.history,
			isLoading: false,
			flavor: 'inference-gateway' as const,
			cadenceMs: 10_000 as const,
			refetch: () => undefined,
		}),
	};
});

const T0 = 1_000_000;

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

// StatRow renders label and value as siblings; assert the value cell alone.
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

afterEach(() => {
	cleanup();
	metrics.history = [];
});

describe('SecurityPage — rate-limit hits by reason', () => {
	const hits = (rate: number, quota: number, warming: number) =>
		[
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="rate_limit_exceeded"} ${rate}`,
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="token_quota_exceeded"} ${quota}`,
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="token_quota_warming"} ${warming}`,
		].join('\n');

	it('names each reason by the gate that refused it', () => {
		metrics.history = [snapshotOf(hits(0, 0, 0), T0), snapshotOf(hits(3, 5, 2), T0 + 10_000)];
		render(
			<MemoryRouter>
				<SecurityPage />
			</MemoryRouter>,
		);
		expect(valueOf('Rate limited (rate_limit_exceeded)')).toBe('0.300/s');
		expect(valueOf('Token quota denied (token_quota_exceeded)')).toBe('0.500/s');
		expect(valueOf('Token quota warming up (token_quota_warming)')).toBe('0.200/s');
		expect(screen.queryByText(/^Rate limited \(token_quota_/)).toBeNull();
	});
});
