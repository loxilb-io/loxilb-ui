//---------------------------------------------------------
// bounded reconciliation 
//
// Replaces the `setTimeout(() => refetch(), 1000)` pattern that followed
// every accepted mutation. That pattern claimed success on HTTP acceptance
// and then looked exactly once, 1 s later: slower gateway convergence left
// the operator with a success popup and a table that did not contain the
// row, no timer handle was kept (a refetch still fired on a page the user
// had already left), and two quick mutations raced two independent blind
// refetches in undefined order.
//
// The contract here is deliberately narrow:
//   * acceptance is NOT confirmation — a mutation the server accepted but
//     that has not yet appeared is `pending`, rendered as "submitted";
//   * `pending` is NEVER an error. It does not block further work and must
//     not be shown as a failure (parent rule 6);
//   * confirmation is a SEMANTIC predicate supplied per endpoint family, so
//     server canonicalization (omitted zero fields, `null` for `[]`, row
//     re-ordering) cannot masquerade as "my write never landed";
//   * the poll budget is bounded and stops on the first confirmation;
//   * unmount and a superseding mutation abort the loop structurally, which
//     is what kills the leaked-timer and racing-refetch modes at the root.
//---------------------------------------------------------
import {useCallback, useEffect, useRef} from 'react';

/**
 * Backoff schedule for the confirm poll, in milliseconds — one read per
 * entry after the acceptance read, so the worst case is
 * `1 + intervals.length` reads over `sum(intervals)`.
 *
 * ⚠ PROVISIONAL pending open question (approved poll/backoff/timeout
 * values). These are deliberately conservative: a total budget of 7.5 s is
 * long enough to cover the gateway convergence actually observed on the
 * testbed under E2E load, short enough that an operator waits through it,
 * and the growth is geometric so a slow backend is not hammered. When 
 * lands, change this table — nothing else — and the whole app adopts it.
 */
export const DEFAULT_RECONCILE_INTERVALS_MS = [500, 1000, 2000, 4000];

/** `confirmed` = observed in the list. `pending` = accepted, not yet visible. */
export type ReconcileOutcome = 'confirmed' | 'pending';

export interface ReconcileSpec<T> {
	/**
	 * Re-read the list this mutation should become visible in, resolving to
	 * the fresh data. Call sites adapt react-query's handle:
	 * `refetch: async () => (await refetch()).data`.
	 */
	refetch: () => Promise<T | undefined>;
	/**
	 * Semantic "did my write land?" predicate — presence/absence by primary
	 * key, never a structural comparison of the submitted object. Omit it for
	 * endpoints that only need cache invalidation, which then resolve
	 * `confirmed` after a single read.
	 */
	confirm?: (latest: T) => boolean;
	/** Override the table for an endpoint family with its own timing. */
	intervalsMs?: number[];
}

/**
 * Adapts react-query's `refetch` handle to a `ReconcileSpec.refetch`. Kept
 * here so the eleven call sites do not each re-derive the same unwrapping.
 */
export function fromQueryRefetch<T>(refetch: () => Promise<{data?: T}>): () => Promise<T | undefined> {
	return async () => (await refetch()).data;
}

/** Resolves after `ms`, or immediately once `signal` aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise(resolve => {
		if (signal.aborted) return resolve();
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		function onAbort() {
			clearTimeout(timer);
			resolve();
		}
		signal.addEventListener('abort', onAbort, {once: true});
	});
}

/**
 * Returns a `reconcile(spec)` bound to the calling component. One poll chain
 * is live per hook instance: starting a second one aborts the first
 * (supersede), and unmounting aborts whatever is running (no refetch on a
 * dead page). A superseded or unmounted chain resolves `pending` — it was
 * abandoned, so it may never claim confirmation.
 */
export function useReconciler() {
	const controllerRef = useRef<AbortController | null>(null);

	useEffect(
		() => () => {
			controllerRef.current?.abort();
			controllerRef.current = null;
		},
		[],
	);

	return useCallback(async function reconcile<T>(spec: ReconcileSpec<T>): Promise<ReconcileOutcome> {
		controllerRef.current?.abort();
		const controller = new AbortController();
		controllerRef.current = controller;
		const {signal} = controller;

		// A transient read failure (the testbed gateway 503s under load) must
		// not end the loop — the next interval simply tries again.
		const read = async (): Promise<T | undefined> => {
			try {
				return await spec.refetch();
			} catch {
				return undefined;
			}
		};

		let latest = await read();
		if (!spec.confirm) return 'confirmed';

		const intervals = spec.intervalsMs ?? DEFAULT_RECONCILE_INTERVALS_MS;
		for (const delay of intervals) {
			if (signal.aborted) return 'pending';
			if (latest !== undefined && spec.confirm(latest)) return 'confirmed';
			await sleep(delay, signal);
			if (signal.aborted) return 'pending';
			latest = await read();
		}

		if (signal.aborted) return 'pending';
		return latest !== undefined && spec.confirm(latest) ? 'confirmed' : 'pending';
	}, []);
}
