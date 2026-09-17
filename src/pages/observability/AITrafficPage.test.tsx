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
