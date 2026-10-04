import {describe, expect, it} from 'vitest';
import {computeCounterRate, pushRetained} from './rates';

const MAX_GAP = 35_000; // 3.5× the 10 s cadence

describe('computeCounterRate — typed degenerate results, never a fabricated zero', () => {
	it('needs two points', () => {
		expect(computeCounterRate(undefined, {value: 5, receivedAtMs: 10_000}, MAX_GAP)).toEqual({kind: 'insufficient-samples'});
		expect(computeCounterRate({value: 5, receivedAtMs: 0}, undefined, MAX_GAP)).toEqual({kind: 'insufficient-samples'});
	});

	it('computes per-second rate over the real elapsed interval', () => {
		const r = computeCounterRate({value: 1000, receivedAtMs: 0}, {value: 1500, receivedAtMs: 10_000}, MAX_GAP);
		expect(r).toEqual({kind: 'ok', perSecond: 50, intervalMs: 10_000});
	});

	it('a decreasing counter is a reset, not negative traffic', () => {
		expect(computeCounterRate({value: 900, receivedAtMs: 0}, {value: 10, receivedAtMs: 10_000}, MAX_GAP)).toEqual({kind: 'reset'});
	});

	it('reversed or zero elapsed time is invalid, not Infinity', () => {
		expect(computeCounterRate({value: 1, receivedAtMs: 10_000}, {value: 2, receivedAtMs: 10_000}, MAX_GAP)).toEqual({kind: 'invalid-interval'});
		expect(computeCounterRate({value: 1, receivedAtMs: 20_000}, {value: 2, receivedAtMs: 10_000}, MAX_GAP)).toEqual({kind: 'invalid-interval'});
	});

	it('a hidden-tab gap beyond tolerance is typed, not an averaged-over-lunch rate', () => {
		expect(computeCounterRate({value: 1, receivedAtMs: 0}, {value: 2, receivedAtMs: 3_600_000}, MAX_GAP)).toEqual({kind: 'gap'});
	});

	it('non-finite counter samples are invalid, never coerced', () => {
		expect(computeCounterRate({value: NaN, receivedAtMs: 0}, {value: 2, receivedAtMs: 10_000}, MAX_GAP)).toEqual({kind: 'invalid-sample'});
		expect(computeCounterRate({value: 1, receivedAtMs: 0}, {value: Infinity, receivedAtMs: 10_000}, MAX_GAP)).toEqual({kind: 'invalid-sample'});
	});
});

describe('pushRetained', () => {
	it('bounds the ring at capacity, oldest out first', () => {
		let ring: {receivedAtMs: number}[] = [];
		for (let i = 1; i <= 8; i++) ring = pushRetained(ring, {receivedAtMs: i * 10_000}, 6);
		expect(ring.map(p => p.receivedAtMs / 10_000)).toEqual([3, 4, 5, 6, 7, 8]);
	});

	it('ignores a duplicate delivery of the same observation', () => {
		// React effects can re-run without new data; the same receivedAtMs must
		// not become a second point (it would zero the next rate interval).
		let ring: {receivedAtMs: number}[] = [];
		ring = pushRetained(ring, {receivedAtMs: 10_000}, 6);
		ring = pushRetained(ring, {receivedAtMs: 10_000}, 6);
		expect(ring).toHaveLength(1);
	});
});
