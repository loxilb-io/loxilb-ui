//---------------------------------------------------------
// Standardized page data states (UI-P6-5)
//---------------------------------------------------------
// One vocabulary for "what is this page actually showing right now", so a
// failed read can never be rendered as a successful empty resource (ES-10 /
// ES-14). Before this module, each page hand-rolled the distinction — or
// skipped it: `error={isError}` is a boolean, so a refresh that failed while
// cached rows were still on screen looked identical to a healthy page, and
// 401/403 (denied) was indistinguishable from 503 (unavailable) and from a
// genuine 500 (failed).
//
// The mapper is deliberately separate from the rendering (QueryStateGate)
// so the precedence rules can be unit-tested as a table, without a DOM.

import {ApiError} from 'connector/fetcher/fetcher_base';
import {fromThrownError} from 'connector/fetcher/opResultAdapter';
import {OpResult} from 'connector/fetcher/opResult';

export type PageDataState<T> =
	| {kind: 'loading'}
	| {kind: 'data'; rows: T; fetchedAt: number}
	/** A successful response carrying zero rows — NOT an error. */
	| {kind: 'empty'; fetchedAt: number}
	/** Last-known-good rows are still on screen, and we can say why the refresh failed. */
	| {kind: 'stale'; rows: T; fetchedAt: number; failure: OpResult}
	/** 401/403 in an inline context (the app-level session teardown is UI-P6-4's). */
	| {kind: 'denied'; result: OpResult}
	/** 502/503/504/timeout/transport — the service is not answering right now. */
	| {kind: 'unavailable'; result: OpResult}
	| {kind: 'failed'; result: OpResult};

export type PageStateKind = PageDataState<unknown>['kind'];

/**
 * The subset of react-query's UseQueryResult this mapper reads. Declared
 * structurally so the precedence table can be tested without building a real
 * QueryClient — a full UseQueryResult<T> satisfies it.
 */
export interface ReadQueryLike<T> {
	data: T | undefined;
	error: unknown;
	dataUpdatedAt: number;
	isFetching?: boolean;
	isPending?: boolean;
}

export interface PageStateOptions<T> {
	/**
	 * Operation name used to build the OpResult code, e.g. 'instance.list'.
	 * Keep it stable — it is a machine code, not display text.
	 */
	op: string;
	/**
	 * Decides whether a *successful* payload counts as empty. Defaults to
	 * "an array with no elements"; object-shaped reads (a single config
	 * record, a metrics snapshot) must pass their own predicate or they will
	 * never report `empty`.
	 */
	isEmpty?: (data: T) => boolean;
}

/** Default emptiness rule: only an actual empty array is empty. */
export function defaultIsEmpty(data: unknown): boolean {
	return Array.isArray(data) && data.length === 0;
}

/**
 * Map a read query onto its page state.
 *
 * Precedence (tested as a table in pageState.test.ts):
 *   1. error + cached rows  → stale   (never let a failed refresh look healthy)
 *   2. error, no rows       → denied | unavailable | failed, by OpResult status
 *   3. no rows yet          → loading
 *   4. rows, isEmpty()      → empty
 *   5. rows                 → data
 *
 * Note the deliberate refinement of the task doc's written order
 * ("loading → (data|empty) → stale → denied/..."): a query that is retrying
 * after a failure is `isFetching` AND errored at the same time, so checking
 * loading first would hide the staleness for the whole retry window — exactly
 * the window in which the operator most needs to be told the rows are old.
 */
export function toPageState<T>(query: ReadQueryLike<T>, opts: PageStateOptions<T>): PageDataState<T> {
	const isEmpty = opts.isEmpty ?? (defaultIsEmpty as (data: T) => boolean);
	// `undefined` is react-query's "no successful response yet"; `null` is a
	// value a connector deliberately returned (IPsec config that is not
	// configured), so it counts as data and must not spin forever.
	const hasRows = query.data !== undefined;

	if (query.error) {
		const failure = fromThrownError(opts.op, query.error);
		if (hasRows) return {kind: 'stale', rows: query.data as T, fetchedAt: query.dataUpdatedAt, failure};
		return fromFailure(failure);
	}

	if (!hasRows) return {kind: 'loading'};

	const rows = query.data as T;
	if (isEmpty(rows)) return {kind: 'empty', fetchedAt: query.dataUpdatedAt};
	return {kind: 'data', rows, fetchedAt: query.dataUpdatedAt};
}

/**
 * Which hard state an OpResult failure belongs to. Split out of toPageState
 * because not every read arrives as a thrown error: the metrics scrape polls
 * and deliberately does not throw, so it carries its failure as a VALUE
 * (`ILiveMetricsResponse.failure`). Both paths must land on the same three
 * kinds, or a denied scrape and a denied list would look different for no
 * reason the operator could name.
 */
export function fromFailure(failure: OpResult): PageDataState<never> {
	switch (failure.status) {
		case 'denied':
			return {kind: 'denied', result: failure};
		case 'unavailable':
			return {kind: 'unavailable', result: failure};
		default:
			return {kind: 'failed', result: failure};
	}
}

/**
 * The write-guard rule (task doc §2.3): stale data can be *looked at*, never
 * *acted on*. This answers "may the operator act on the ROWS on screen?" —
 * Edit and Delete take a selected row as their target, so rows we cannot vouch
 * for make them unsafe.
 */
export function writesEnabled(state: PageDataState<unknown>): boolean {
	return state.kind === 'data' || state.kind === 'empty';
}

/**
 * May the operator create a NEW item? A different question, and the first cut
 * of this task got it wrong by answering it with `writesEnabled`.
 *
 * Add reads nothing off the table: it does not target a row, so rows that are
 * missing or untrustworthy do not make it unsafe. Blocking it whenever a read
 * failed removed the one action that still makes sense when a list will not
 * load — and broke a supported flow, creating a BGP neighbour on an instance
 * whose neighbour list answers 403 because BGP mode is off
 * (`cicd/ha/bgp-neighbor.spec.ts`). It also went dead during every ordinary
 * page load, where nothing is stale because nothing has been claimed yet.
 *
 * `stale` is the one state that does bar it: rows exist and are being shown,
 * but may not match the server, so the operator could duplicate something they
 * cannot see.
 */
export function createEnabled(state: PageDataState<unknown>): boolean {
	return state.kind !== 'stale';
}

/**
 * Turn whatever a read connector threw into the same OpResult vocabulary the
 * mutation path already speaks (UI-P6-1). Exported for connectors and tests.
 */
export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}
