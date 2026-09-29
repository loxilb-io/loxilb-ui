//---------------------------------------------------------
// AI Traffic page — the two rendering paths (UI-MON-008)
//---------------------------------------------------------
// The derivation itself is covered in observability/aiRequests.test.ts. What
// is asserted HERE is the thing an operator actually sees, and the regression
// that unit tests cannot catch: that the stale-denominator notice survives on
// a gateway without the outcome partition, and is gone on one with it.
//
// This is the page that was shipping a false statement for a whole release —
// it claimed no total request rate could be shown after upstream had supplied
// the denominator. Deleting the notice outright would swap one wrong answer
// for another on older gateways, so the conditional is the deliverable and a
// test that only exercised the partitioned path would miss half of it.

import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from 'observability/parser';
import {AI_REQUESTS} from 'observability/aiRequests';
import AITrafficPage from './AITrafficPage';

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

// Partitioned: completed 200s, a 503 a backend answered, and gate denials.
const PARTITIONED = (completed: number, denied: number, failed: number) =>
	[
		`${AI_REQUESTS}{model="m",tenant="t",status="200",outcome="completed"} ${completed}`,
		`${AI_REQUESTS}{model="m",tenant="t",status="503",outcome="completed"} ${failed}`,
		`${AI_REQUESTS}{model="m",tenant="t",status="429",outcome="denied"} ${denied}`,
	].join('\n');

// Pre-partition gateway: no outcome label anywhere.
const UNPARTITIONED = (completed: number) => `${AI_REQUESTS}{model="m",tenant="t",status="200"} ${completed}`;

const STALE_NOTICE = /does not yet expose a complete request denominator/;

function renderWith(history: IMetricsSnapshot[]) {
	metrics.history = history;
	render(
		<MemoryRouter>
			<AITrafficPage />
		</MemoryRouter>,
	);
}

afterEach(() => {
	cleanup();
	metrics.history = [];
});

describe('AITrafficPage — unpartitioned gateway', () => {
	it('still renders the stale-denominator notice, because there it is true', () => {
		renderWith([snapshotOf(UNPARTITIONED(100), T0), snapshotOf(UNPARTITIONED(200), T0 + 10_000)]);
		expect(screen.getByText(STALE_NOTICE)).toBeTruthy();
	});

	it('renders no offered-load panel at all rather than an empty or zeroed one', () => {
		renderWith([snapshotOf(UNPARTITIONED(100), T0), snapshotOf(UNPARTITIONED(200), T0 + 10_000)]);
		expect(screen.queryByText('Request outcomes (offered load)')).toBeNull();
		expect(screen.queryByText('Total offered')).toBeNull();
		expect(screen.queryByText('Error ratio (denied + failed)')).toBeNull();
	});
});

describe('AITrafficPage — partitioned gateway', () => {
	it('drops the stale notice once the denominator exists', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		expect(screen.queryByText(STALE_NOTICE)).toBeNull();
	});

	it('renders offered load as the whole family, not the completed rate', () => {
		// completed 10/s + failed 1/s + denied 10/s = 21/s offered.
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		expect(screen.getByText('Request outcomes (offered load)')).toBeTruthy();
		expect(screen.getByText('21.0/s')).toBeTruthy();
		// 11/21 of offered load failed or was refused = 52.38%, rendered at the
		// one-decimal precision formatRatio uses above 10%.
		expect(screen.getByText('52.4%')).toBeTruthy();
	});

	// The degenerate case an operator meets most: one poll in, nothing
	// diffable yet. It must read as warming up, never as 0/s and 0%.
	it('reads warming up on a single observation instead of printing zeros', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0)]);
		expect(screen.getAllByText('Warming up…').length).toBeGreaterThan(0);
		expect(screen.queryByText('0%')).toBeNull();
	});

	// An idle gateway has no error ratio: 0/0 is not 0%.
	it('reads no traffic rather than 0% when the counters did not move', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(100, 5, 10), T0 + 10_000)]);
		expect(screen.getByText('No traffic')).toBeTruthy();
	});
});

// ⭐ The defect this pins: the denial, token and session counters are labelled
// vecs that emit nothing until their first increment, and each needs
// configuration first (an API-key store, a token quota, a session header).
// On an idle gateway they are absent for the life of the process, and every
// such row printed "Warming up…" — a transient state that never ended.
describe('AITrafficPage — families an idle gateway never exports', () => {
	const rowText = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

	it('says nothing was reported instead of warming up forever', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		for (const label of ['Model not allowed', 'Token quota denied', 'Normal session hits']) {
			expect(rowText(label)).toContain('None reported');
			expect(rowText(label)).not.toContain('Warming up…');
		}
	});

	it('keeps the token-consumed quantity on screen when its family is absent', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		expect(rowText('Consumed')).toContain('None reported');
	});

	it('never counts engines it was not told about as zero', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		expect(rowText('Engines reporting')).toContain('None reported');
	});
});

// The denial panel listed "Rate limited" (all of rate_limit_hits, quota
// reasons included) beside "Token quota denied" as if they were two causes,
// while every quota refusal was in both.
describe('AITrafficPage — denial reasons do not overlap', () => {
	const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
	const exposition = (rate: number, quota: number, warming: number) =>
		[
			PARTITIONED(100, rate + quota + warming, 0),
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="rate_limit_exceeded"} ${rate}`,
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="token_quota_exceeded"} ${quota}`,
			`loxilb_ai_rate_limit_hits_total{tenant="t",reason="token_quota_warming"} ${warming}`,
			`loxilb_ai_token_quota_denied_total{tenant="t"} ${quota}`,
		].join('\n');

	it('keeps quota refusals out of "Rate limited" and gives warming its own row', () => {
		renderWith([snapshotOf(exposition(0, 0, 0), T0), snapshotOf(exposition(3, 5, 2), T0 + 10_000)]);
		expect(valueOf('Rate limited')).toBe('0.300/s');
		expect(valueOf('Token quota denied')).toBe('0.500/s');
		expect(valueOf('Token quota warming up')).toBe('0.200/s');
	});
});

// "Completed" is recorded at SSE stream completion OR at response headers, so
// plain-JSON answers are in it; the panel called every one an "SSE stream".
describe('AITrafficPage — completed is not streams only', () => {
	it('titles the completed panel as requests, and says "SSE stream" nowhere', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		expect(screen.getByText('Completed requests (not total requests)')).toBeTruthy();
		expect(screen.queryByText(/SSE stream/)).toBeNull();
	});

	it('says "completed requests" in the unpartitioned notice too', () => {
		renderWith([snapshotOf(UNPARTITIONED(100), T0), snapshotOf(UNPARTITIONED(200), T0 + 10_000)]);
		expect(screen.getByText(STALE_NOTICE).textContent).toMatch(/^Completed requests and denial events/);
	});
});

// tokens_missing counts responses, not tokens, and sat as a bare "/s" beside
// token rates under "Missing (unaccountable)" — with the charged
// stream_estimated responses summed in.
describe('AITrafficPage — responses without usage', () => {
	const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
	const exposition = (uncharged: number, estimated: number) =>
		[
			PARTITIONED(100, 0, 0),
			`loxilb_ai_tokens_missing_total{model="m",tenant="t",reason="response_complete"} ${uncharged}`,
			`loxilb_ai_tokens_missing_total{model="m",tenant="t",reason="stream_estimated"} ${estimated}`,
		].join('\n');

	it('counts responses per second, split by whether they were charged', () => {
		renderWith([snapshotOf(exposition(0, 0), T0), snapshotOf(exposition(3, 5), T0 + 10_000)]);
		expect(valueOf('Responses without usage, not charged')).toBe('0.300 responses/s');
		expect(valueOf('Responses without usage, charged from estimate')).toBe('0.500 responses/s');
		expect(screen.queryByText('Missing (unaccountable)')).toBeNull();
	});
});

// The admission gate and listener counters get their own registry entries,
// so the page mounts them beside its own panels.
describe('AITrafficPage — admission gate and listener overload', () => {
	it('mounts both panels and reads an ungated pool as not gated', () => {
		const gate = [
			'loxilb_ai_admission_mode{service="s:1",pool="p1"} 0',
			'loxilb_ai_admission_inflight{service="s:1",pool="p1",role="service"} 0',
			'loxilb_ai_admission_limit{service="s:1",pool="p1",role="service"} 0',
			'loxilb_ai_admission_limit{service="s:1",pool="p1",role="queue"} 0',
			'loxilb_ai_admission_queued{service="s:1",pool="p1"} 0',
			'loxilb_ai_admission_anomalies_total{kind="underflow"} 0',
			'loxilb_proxy_listen_drops_total 0',
			'loxilb_proxy_listen_overflows_total 0',
			'loxilb_proxy_header_deadline_drops_total 0',
		].join('\n');
		renderWith([snapshotOf(`${PARTITIONED(1, 0, 0)}\n${gate}`, T0)]);
		expect(screen.getByText('Admission gate (capacity)')).toBeTruthy();
		expect(screen.getByText('Listener overload')).toBeTruthy();
		expect(screen.getAllByText('Not gated')).toHaveLength(2);
	});
});
