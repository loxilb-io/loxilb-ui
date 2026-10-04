//---------------------------------------------------------
// What the time-series localStorage path is allowed to believe
//---------------------------------------------------------
// The persisted metrics snapshot taught this lesson once already: a value
// read back from localStorage is not necessarily one THIS build wrote, and a
// throw on the render path unmounts the page rather than degrading it.
//
// This is the same mechanism one level out. `createTimeSeriesHook` restores a
// series in a `useState` initializer — during render — and it used to
// `JSON.parse` unguarded and hand the result straight to `pruneOld`, which
// calls `.filter`. `DashboardPage.readStoredLayout` already guarded its own
// parse; this path did not.
//---------------------------------------------------------
import {beforeEach, describe, expect, it} from 'vitest';
import {readStoredSeries, MAX_DURATION_MS} from './common';
import {save_local_storage} from 'common';

const KEY = 'conntrack-series_1';

beforeEach(() => {
	localStorage.clear();
});

describe('readStoredSeries', () => {
	it('returns the stored points when the value is well formed', () => {
		// The case that must keep working: hardening is worthless if it also
		// discards good data.
		const now = Date.now();
		save_local_storage(KEY, JSON.stringify([{timestamp: now, data: {rx: 1}}]));
		expect(readStoredSeries<{rx: number}>(KEY)).toEqual([{timestamp: now, data: {rx: 1}}]);
	});

	it('survives a value that is valid JSON but NOT an array', () => {
		// `pruneOld` calls `.filter`. Before the guard this threw
		// `parsed.filter is not a function` inside a useState initializer —
		// i.e. during render, which unmounts the page.
		save_local_storage(KEY, JSON.stringify({}));
		expect(() => readStoredSeries(KEY)).not.toThrow();
		expect(readStoredSeries(KEY)).toEqual([]);
	});

	it('survives malformed JSON', () => {
		localStorage.setItem(KEY, '{"timestamp":');
		expect(() => readStoredSeries(KEY)).not.toThrow();
		expect(readStoredSeries(KEY)).toEqual([]);
	});

	it('DROPS the unusable value instead of keeping it', () => {
		// Keeping it means meeting the same bad value on the next mount. A
		// series re-accumulates from polling within seconds, so dropping costs
		// almost nothing and ends the failure permanently.
		save_local_storage(KEY, JSON.stringify({not: 'a series'}));
		readStoredSeries(KEY);
		expect(localStorage.getItem(KEY)).toBeNull();
	});

	it('keeps the good points of a partially malformed series', () => {
		// All-or-nothing would throw away a day of history over one bad entry.
		const now = Date.now();
		save_local_storage(
			KEY,
			JSON.stringify([{timestamp: now, data: 1}, null, {timestamp: 'not-a-number', data: 2}, {timestamp: now, data: 3}]),
		);
		expect(readStoredSeries<number>(KEY).map(p => p.data)).toEqual([1, 3]);
	});

	it('rejects a string timestamp, which arithmetic alone would have accepted', () => {
		// This is why the per-point check is not redundant with pruneOld:
		// `Date.now() - "123"` coerces to a number, so a string-timestamped
		// point passes the age filter and reaches every chart downstream.
		save_local_storage(KEY, JSON.stringify([{timestamp: String(Date.now()), data: 1}]));
		expect(readStoredSeries(KEY)).toEqual([]);
	});

	it('still applies the age window to what it returns', () => {
		// The guard must not accidentally bypass pruning.
		const stale = Date.now() - (MAX_DURATION_MS + 60_000);
		save_local_storage(KEY, JSON.stringify([{timestamp: stale, data: 1}]));
		expect(readStoredSeries(KEY)).toEqual([]);
	});

	it('returns empty for a key that was never written', () => {
		expect(readStoredSeries('never-written-series_9')).toEqual([]);
	});
});
