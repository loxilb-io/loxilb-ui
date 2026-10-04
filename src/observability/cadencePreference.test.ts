import {renderHook, act} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {useObservabilityCadence} from 'hooks/query/observabilityHooks';
import {
	DEFAULT_OBSERVABILITY_CADENCE_MS,
	isObservabilityCadence,
	OBSERVABILITY_CADENCE_OPTIONS_MS,
	PREFERENCE_KEYS,
} from 'preferences';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {groupRates, rateMaxGapMs, RATE_MAX_GAP_MS} from './snapshotRates';

afterEach(() => localStorage.clear());

describe('observability cadence preference', () => {
	// Every option must stay honest by construction: freshness (1.5×/3×)
	// and rate gap tolerance (3.5×) derive from the chosen interval, so the
	// guard is the single gate deciding what a stored value may be.
	it('accepts exactly the pinned option values', () => {
		for (const ms of OBSERVABILITY_CADENCE_OPTIONS_MS) expect(isObservabilityCadence(ms)).toBe(true);
		// An arbitrary number would silently break the honesty relation
		// between cadence and thresholds; strings are corruption.
		expect(isObservabilityCadence(7_000)).toBe(false);
		expect(isObservabilityCadence(0)).toBe(false);
		expect(isObservabilityCadence(-10_000)).toBe(false);
		expect(isObservabilityCadence('10000')).toBe(false);
		expect(isObservabilityCadence(Number.NaN)).toBe(false);
	});

	it('an untrusted stored value falls back to the honest default', () => {
		localStorage.setItem(PREFERENCE_KEYS.observabilityCadence, JSON.stringify(7_000));
		const {result} = renderHook(() => useObservabilityCadence());
		expect(result.current[0]).toBe(DEFAULT_OBSERVABILITY_CADENCE_MS);
	});

	it('a valid stored value is adopted and a set persists under the pinned key', () => {
		localStorage.setItem(PREFERENCE_KEYS.observabilityCadence, JSON.stringify(30_000));
		const {result} = renderHook(() => useObservabilityCadence());
		expect(result.current[0]).toBe(30_000);
		act(() => result.current[1](60_000));
		expect(localStorage.getItem('observability_cadence_ms')).toBe(JSON.stringify(60_000));
	});
});

describe('rateMaxGapMs', () => {
	it('preserves the recorded 35 s tolerance at the default cadence', () => {
		expect(rateMaxGapMs(DEFAULT_OBSERVABILITY_CADENCE_MS)).toBe(RATE_MAX_GAP_MS);
	});

	// The defect this scaling exists to prevent: at a 60 s operator-selected
	// cadence, the fixed 35 s tolerance would classify EVERY healthy interval
	// as a gap and the whole surface would read "Gap in samples" forever.
	it('a healthy 60 s interval rates normally with the scaled tolerance and gaps with the fixed one', () => {
		const snap = (text: string, at: number): IMetricsSnapshot => {
			const parsed = parseExposition(text);
			return {
				instanceId: 1,
				flavor: 'inference-gateway',
				receivedAtMs: at,
				available: true,
				families: parsed.families,
				diagnostics: parsed.diagnostics,
			};
		};
		const history = [snap('c 100', 1_000_000), snap('c 160', 1_060_000)];

		const scaled = groupRates(history, 'c', [], rateMaxGapMs(60_000));
		expect(scaled[0].rate).toEqual({kind: 'ok', perSecond: 1, intervalMs: 60_000});

		const fixed = groupRates(history, 'c', [], RATE_MAX_GAP_MS);
		expect(fixed[0].rate.kind).toBe('gap');
	});
});
