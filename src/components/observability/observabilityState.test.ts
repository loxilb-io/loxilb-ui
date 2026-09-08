import {describe, expect, it} from 'vitest';
import {OpResult} from 'connector/fetcher/opResult';
import {IMetricsSnapshot} from 'types/observability';
import {classifyViewState, IViewStateInput, unknownValueState} from './observabilityState';

const CADENCE = 10_000;
const NOW = 1_000_000;

function snapshot(overrides: Partial<IMetricsSnapshot> = {}): IMetricsSnapshot {
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: NOW - 5_000,
		available: true,
		families: new Map(),
		diagnostics: {skippedSamples: 0, warnings: [], totalSamples: 10, dependencyFamilies: 0},
		...overrides,
	};
}

function input(overrides: Partial<IViewStateInput> = {}): IViewStateInput {
	return {
		applicable: true,
		isLoading: false,
		snapshot: snapshot(),
		hasData: true,
		nowMs: NOW,
		cadenceMs: CADENCE,
		...overrides,
	};
}

const DENIED: OpResult = {status: 'denied', code: 'observability.scrape.denied', localeKey: 'Permission denied', retryable: false};
const UNAVAILABLE: OpResult = {status: 'unavailable', code: 'observability.scrape.unavailable', localeKey: 'x', retryable: true};

describe('classifyViewState precedence', () => {
	it('applicability is a contract decision and comes first', () => {
		// Even a denied scrape on a non-applicable panel reads N/A: the panel
		// should not exist for this flavor, so no error is the panel's to show.
		expect(classifyViewState(input({applicable: false, snapshot: snapshot({failure: DENIED})}))).toEqual({kind: 'not-applicable'});
	});

	it('sample absence is NOT an applicability input', () => {
		// An applicable panel whose lazy series emitted nothing is no-data —
		// never re-classified as not-applicable.
		expect(classifyViewState(input({hasData: false}))).toEqual({kind: 'no-data'});
	});

	it('an authoritative disabled signal beats transport states', () => {
		const s = classifyViewState(input({disabledReasonKey: 'GPU monitoring is disabled.', snapshot: snapshot({failure: UNAVAILABLE})}));
		expect(s).toEqual({kind: 'disabled', reasonKey: 'GPU monitoring is disabled.'});
	});

	it('loading before the first observation, never a synthesized zero', () => {
		expect(classifyViewState(input({snapshot: undefined, isLoading: true}))).toEqual({kind: 'loading'});
		expect(classifyViewState(input({snapshot: undefined, isLoading: false}))).toEqual({kind: 'loading'});
	});

	it('denied never falls through to an empty-looking state', () => {
		const s = classifyViewState(input({snapshot: snapshot({failure: DENIED}), hasData: false}));
		expect(s.kind).toBe('denied');
	});

	it('unavailable carries the failure for retry rendering', () => {
		const s = classifyViewState(input({snapshot: snapshot({failure: UNAVAILABLE})}));
		expect(s).toEqual({kind: 'unavailable', failure: UNAVAILABLE});
	});

	it('stale at ≥3× the source cadence, keeping the last value visible', () => {
		const old = snapshot({receivedAtMs: NOW - CADENCE * 3});
		expect(classifyViewState(input({snapshot: old}))).toEqual({kind: 'stale', receivedAtMs: old.receivedAtMs});
		// Just under the threshold is not stale.
		const aging = snapshot({receivedAtMs: NOW - CADENCE * 3 + 1});
		expect(classifyViewState(input({snapshot: aging}))).toEqual({kind: 'ready'});
	});

	it('partial when samples were skipped, with the diagnostics attached', () => {
		const torn = snapshot({diagnostics: {skippedSamples: 3, warnings: ['w'], totalSamples: 7, dependencyFamilies: 0}});
		expect(classifyViewState(input({snapshot: torn}))).toEqual({kind: 'partial', skippedSamples: 3, warnings: ['w']});
	});

	it('a valid zero is ready — the widget renders 0, no state is synthesized', () => {
		expect(classifyViewState(input({hasData: true}))).toEqual({kind: 'ready'});
	});
});

describe('unknownValueState', () => {
	it('carries the raw token for safe display', () => {
		expect(unknownValueState('half-open')).toEqual({kind: 'unknown', raw: 'half-open'});
	});
});
