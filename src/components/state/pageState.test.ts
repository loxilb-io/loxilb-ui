//---------------------------------------------------------
// UI-P6-5 — the page-state precedence table
// (npm test src/components/state/pageState.test.ts)
//
// RED against the stub in pageState.ts, which throws. These cases are the
// contract: every one of them describes a situation the app can be in today
// and currently renders indistinguishably from a healthy page.
//
// The two that matter most, because no existing mechanism can express them:
//
//   - STALE. `error={isError}` is a boolean and react-query keeps serving the
//     last successful rows when a background refetch fails, so today the
//     operator sees rows with an error banner and no way to tell how old they
//     are — and every write button stays live against data we no longer know
//     to be current (ES-14, "stale data must not enable destructive actions").
//   - DENIED vs UNAVAILABLE vs FAILED. All three collapse into the same
//     "Couldn't load … The server returned an error." banner, so a permission
//     problem the operator could fix reads the same as a gateway that is down.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {defaultIsEmpty, PageDataState, ReadQueryLike, toPageState, writesEnabled} from './pageState';

const FETCHED_AT = 1_756_700_000_000;

/** A settled successful query. */
function ok<T>(data: T, over: Partial<ReadQueryLike<T>> = {}): ReadQueryLike<T> {
	return {data, error: null, dataUpdatedAt: FETCHED_AT, isFetching: false, isPending: false, ...over};
}

/** A query that has never resolved. */
function pending<T>(over: Partial<ReadQueryLike<T>> = {}): ReadQueryLike<T> {
	return {data: undefined, error: null, dataUpdatedAt: 0, isFetching: true, isPending: true, ...over};
}

/** A query that failed, optionally still holding rows from an earlier success. */
function failed<T>(status: number, data?: T, over: Partial<ReadQueryLike<T>> = {}): ReadQueryLike<T> {
	return {
		data,
		error: new ApiError(`boom ${status}`, status),
		dataUpdatedAt: data === undefined ? 0 : FETCHED_AT,
		isFetching: false,
		isPending: false,
		...over,
	};
}

const OPTS = {op: 'test.list'} as const;

describe('toPageState — precedence', () => {
	it('a query that has never resolved is loading', () => {
		expect(toPageState(pending<number[]>(), OPTS)).toEqual<PageDataState<number[]>>({kind: 'loading'});
	});

	it('a disabled query (no data, not fetching, no error) is loading, not empty', () => {
		// useQueryInstanceData is `enabled: !!instance`, so every instance page
		// mounts with a query that is idle. Reading that as "empty" would flash
		// "No … entries yet" on every navigation before the instance resolves.
		const state = toPageState(pending<number[]>({isFetching: false, isPending: true}), OPTS);
		expect(state.kind).toBe('loading');
	});

	it('rows render as data with their fetch time', () => {
		expect(toPageState(ok([1, 2]), OPTS)).toEqual<PageDataState<number[]>>({kind: 'data', rows: [1, 2], fetchedAt: FETCHED_AT});
	});

	it('a successful empty array is empty, never an error', () => {
		expect(toPageState(ok<number[]>([]), OPTS)).toEqual<PageDataState<number[]>>({kind: 'empty', fetchedAt: FETCHED_AT});
	});

	it('an error while cached rows are still on screen is stale, not failed', () => {
		const state = toPageState(failed(500, [1, 2]), OPTS);
		expect(state.kind).toBe('stale');
		if (state.kind !== 'stale') throw new Error('unreachable');
		expect(state.rows).toEqual([1, 2]);
		expect(state.fetchedAt).toBe(FETCHED_AT);
		expect(state.failure.status).toBe('failed');
	});

	it('stale wins over loading while the query is retrying', () => {
		// react-query retries 3× at 3s here, so this state lasts ~9 seconds —
		// precisely when the operator must not be told "loading" over rows that
		// are already known to be out of date.
		const state = toPageState(failed(503, [1], {isFetching: true}), OPTS);
		expect(state.kind).toBe('stale');
	});

	it('stale rows that are empty still report stale, not empty', () => {
		const state = toPageState(failed(500, [] as number[]), OPTS);
		expect(state.kind).toBe('stale');
	});
});

describe('toPageState — failure classification', () => {
	it.each([
		[401, 'denied'],
		[403, 'denied'],
		[429, 'denied'],
		[502, 'unavailable'],
		[503, 'unavailable'],
		[504, 'unavailable'],
		[500, 'failed'],
		[400, 'failed'],
		[404, 'failed'],
		[501, 'failed'],
	])('HTTP %i with no cached rows renders as %s', (status, kind) => {
		expect(toPageState(failed(status as number), OPTS).kind).toBe(kind);
	});

	it('a thrown non-ApiError (transport / DNS / abort) is unavailable, not failed', () => {
		const state = toPageState({data: undefined, error: new TypeError('Failed to fetch'), dataUpdatedAt: 0}, OPTS);
		expect(state.kind).toBe('unavailable');
	});

	it('the OpResult carries the operation code and a locale key, never raw server prose', () => {
		const state = toPageState(failed(503), OPTS);
		if (state.kind !== 'unavailable') throw new Error('expected unavailable');
		expect(state.result.code).toBe('test.list.unavailable');
		expect(state.result.localeKey).not.toContain('boom');
		expect(state.result.retryable).toBe(true);
		// Server text is diagnostics-only, and must be present for support.
		expect(state.result.rawDetail).toContain('boom');
	});

	it('a 400/422 read is classified failed, not invalid — a read carries no user input to correct', () => {
		// `invalid` belongs to the mutation vocabulary: it tells the operator to
		// fix the form they just submitted. A GET has no form, so surfacing
		// "the request was rejected as invalid" would send them looking for
		// input that does not exist.
		expect(toPageState(failed(422), OPTS).kind).toBe('failed');
	});
});

describe('toPageState — emptiness', () => {
	it('a non-array payload is never empty by default', () => {
		// Object-shaped reads (a single config record) must opt in, or a
		// perfectly good record would render as "no entries yet".
		expect(toPageState(ok({a: 1}), OPTS).kind).toBe('data');
	});

	it('honours a caller-supplied isEmpty predicate', () => {
		const state = toPageState(ok({archives: [] as string[]}), {op: 'test.archives', isEmpty: d => d.archives.length === 0});
		expect(state.kind).toBe('empty');
	});

	it('defaultIsEmpty only treats an empty array as empty', () => {
		expect(defaultIsEmpty([])).toBe(true);
		expect(defaultIsEmpty([0])).toBe(false);
		expect(defaultIsEmpty(null)).toBe(false);
		expect(defaultIsEmpty({})).toBe(false);
		expect(defaultIsEmpty('')).toBe(false);
	});
});

describe('writesEnabled — the ES-14 guard', () => {
	it('allows writes only when the data on screen is current', () => {
		expect(writesEnabled({kind: 'data', rows: [1], fetchedAt: FETCHED_AT})).toBe(true);
		expect(writesEnabled({kind: 'empty', fetchedAt: FETCHED_AT})).toBe(true);
	});

	it.each<PageDataState<unknown>>([
		{kind: 'loading'},
		{kind: 'stale', rows: [1], fetchedAt: FETCHED_AT, failure: {status: 'failed', code: 'x', localeKey: 'k', retryable: false}},
		{kind: 'denied', result: {status: 'denied', code: 'x', localeKey: 'k', retryable: false}},
		{kind: 'unavailable', result: {status: 'unavailable', code: 'x', localeKey: 'k', retryable: true}},
		{kind: 'failed', result: {status: 'failed', code: 'x', localeKey: 'k', retryable: false}},
	])('refuses writes in $kind', state => {
		expect(writesEnabled(state)).toBe(false);
	});
});
