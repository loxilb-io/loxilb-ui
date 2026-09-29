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

// Compact by rule (owner, 2026-09-29): the breakdowns moved to Grafana. This
// pins that they stay gone — a panel creeping back is a scope regression.
describe('AITrafficPage — compact: breakdowns are Grafana\'s', () => {
	it('renders no per-status, per-reason, token, latency or affinity panel', () => {
		renderWith([snapshotOf(PARTITIONED(100, 5, 10), T0), snapshotOf(PARTITIONED(200, 105, 20), T0 + 10_000)]);
		for (const title of [
			'Completed requests (not total requests)',
			'Denial events (counted at point of denial)',
			'Token accounting',
			'Request duration (completed streams, all models)',
			'Session affinity',
			'Active streams by model',
		]) {
			expect(screen.queryByText(title)).toBeNull();
		}
		// The partitioned headline carries "completed" itself.
		expect(screen.getByText('Completed (answered by a backend)')).toBeTruthy();
	});
});

// "Completed" is recorded at SSE stream completion OR at response headers, so
// plain-JSON answers are in it; the panel called every one an "SSE stream".
describe('AITrafficPage — unpartitioned: two partial views, never a total', () => {
	const rowText = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

	it('titles the completed panel as requests, and says "SSE stream" nowhere', () => {
		renderWith([snapshotOf(UNPARTITIONED(100), T0), snapshotOf(UNPARTITIONED(200), T0 + 10_000)]);
		expect(screen.getByText('Completed requests (not total requests)')).toBeTruthy();
		expect(rowText('Completed requests')).toContain('10.0/s');
		expect(screen.queryByText(/SSE stream/)).toBeNull();
	});

	it('says "completed requests" in the unpartitioned notice too', () => {
		renderWith([snapshotOf(UNPARTITIONED(100), T0), snapshotOf(UNPARTITIONED(200), T0 + 10_000)]);
		expect(screen.getByText(STALE_NOTICE).textContent).toMatch(/^Completed requests and denial events/);
	});

	// Every quota refusal is in BOTH rate_limit_hits and token_quota_denied:
	// 5 quota refusals are 0.5/s of denials, not 1.0/s.
	it('counts a token-quota refusal once in the denial total', () => {
		const exposition = (quota: number) =>
			[
				UNPARTITIONED(100),
				`loxilb_ai_rate_limit_hits_total{tenant="t",reason="token_quota_exceeded"} ${quota}`,
				`loxilb_ai_token_quota_denied_total{tenant="t"} ${quota}`,
			].join('\n');
		renderWith([snapshotOf(exposition(0), T0), snapshotOf(exposition(5), T0 + 10_000)]);
		expect(rowText('Denial events')).toContain('0.500/s');
	});

	// The denial families are lazy vecs that emit nothing until their first
	// increment; on an idle gateway "Warming up…" would never end.
	it('says nothing was reported instead of warming up forever', () => {
		renderWith([snapshotOf(UNPARTITIONED(100), T0), snapshotOf(UNPARTITIONED(200), T0 + 10_000)]);
		expect(rowText('Denial events')).toContain('None reported');
		expect(rowText('Denial events')).not.toContain('Warming up…');
	});
});

describe('AITrafficPage — active streams as one total', () => {
	const rowText = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

	it('sums over models and counts the models reporting', () => {
		const streams = ['loxilb_ai_active_streams{model="a"} 3', 'loxilb_ai_active_streams{model="b"} 4'].join('\n');
		renderWith([snapshotOf(`${PARTITIONED(1, 0, 0)}\n${streams}`, T0)]);
		expect(rowText('Total (sum over models)')).toContain('7');
		expect(rowText('Models reporting')).toContain('2');
	});

	// Absent is not zero: no series is "No data", never a measured 0 streams.
	it('reads an absent family as no data, not as zero streams', () => {
		renderWith([snapshotOf(PARTITIONED(1, 0, 0), T0)]);
		expect(rowText('Total (sum over models)')).toContain('No data');
	});
});

// The admission gate and listener counters get their own registry entries,
// so the page mounts them beside its own panels.
describe('AITrafficPage — admission gate and listener overload', () => {
	it('mounts both panels and says an all-off gate is off instead of printing zeros', () => {
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
		expect(screen.getByText(/The capacity gate is off on every pool/)).toBeTruthy();
		expect(screen.queryByText('Refusal decisions')).toBeNull();
	});
});
