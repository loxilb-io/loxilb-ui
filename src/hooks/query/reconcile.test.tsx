//---------------------------------------------------------
// UI-P6-3 — bounded reconciliation replaces the blind 1-second refetch
// (npm test src/hooks/query/reconcile.test.tsx)
//
// Red-first against the pattern repeated at 49 sites (C-2 inventory, 49/19;
// Tranche A = 11):
//
//     openPopUp(t('Success'), t('Added successfully.'), t('OK'));  // (1)
//     setTimeout(() => { refetch(); }, 1000);                      // (2)
//
// (1) claims success on HTTP acceptance — before the dataplane has applied
// anything — and (2) looks exactly once, 1 s later, whether or not the write
// has converged. Contract under test: a mutation that is accepted but not yet
// visible is `pending` ("submitted"), NEVER a success and NEVER an error; the
// reconciler polls a bounded budget and stops the moment the list confirms;
// unmount and a superseding mutation abort the loop structurally; a transient
// refetch failure mid-loop is survivable; and confirmation is a SEMANTIC
// predicate, so server canonicalization (omitted zeros, null vs [], row
// ordering) can never masquerade as "my row never appeared".
//---------------------------------------------------------
import {act, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useEffect, useRef} from 'react';
import {DEFAULT_RECONCILE_INTERVALS_MS, ReconcileOutcome, useReconciler} from 'hooks/query/reconcile';

//---------------------------------------------------------
// Harness: mount the hook, drive it imperatively, observe the outcome.
//---------------------------------------------------------
type Row = {name: string; port?: number};

function Harness(props: {
	onReady: (run: (spec: Parameters<ReturnType<typeof useReconciler>>[0]) => Promise<ReconcileOutcome>) => void;
}) {
	const reconcile = useReconciler();
	const ready = useRef(false);
	useEffect(() => {
		if (ready.current) return;
		ready.current = true;
		props.onReady(reconcile as never);
	}, [props, reconcile]);
	return null;
}

/** Mount and hand back the reconcile function plus an unmount handle. */
function mountReconciler() {
	let run!: (spec: any) => Promise<ReconcileOutcome>;
	const view = render(<Harness onReady={r => (run = r)} />);
	return {run: (spec: any) => run(spec), unmount: view.unmount};
}

/**
 * Advance fake timers until `p` settles. The reconciler interleaves awaited
 * refetches with timer sleeps, so each tick has to yield to the microtask
 * queue before the next timer is due.
 */
async function settle<T>(p: Promise<T>): Promise<T> {
	let done = false;
	const tracked = p.then(v => ((done = true), v));
	for (let i = 0; i < 200 && !done; i++) {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(250);
		});
	}
	return tracked;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('UI-P6-3 reconciler — bounded convergence, honest outcomes', () => {
	it('1. converges on a later poll → confirmed (today: success is claimed at once, one blind look)', async () => {
		// The row shows up only on the 3rd read: acceptance, then two polls.
		let reads = 0;
		const refetch = vi.fn(async () => {
			reads += 1;
			return reads >= 3 ? [{name: 'svc-a'}] : [];
		});

		const {run} = mountReconciler();
		const outcome = await settle(run({refetch, confirm: (rows: Row[]) => rows.some(r => r.name === 'svc-a')}));

		expect(outcome).toBe('confirmed');
		// Stops as soon as it confirms — no further polling of a settled write.
		expect(refetch).toHaveBeenCalledTimes(3);
	});

	it('2. never converges within the budget → pending, which is NOT a failure', async () => {
		const refetch = vi.fn(async () => [] as Row[]);

		const {run} = mountReconciler();
		const outcome = await settle(run({refetch, confirm: (rows: Row[]) => rows.some(r => r.name === 'ghost')}));

		expect(outcome).toBe('pending');
		// Bounded: the acceptance read plus exactly one read per interval.
		expect(refetch).toHaveBeenCalledTimes(DEFAULT_RECONCILE_INTERVALS_MS.length + 1);
	});

	it('3. no confirm predicate (invalidation-only endpoints) → one refetch, zero polls', async () => {
		const refetch = vi.fn(async () => [] as Row[]);

		const {run} = mountReconciler();
		const outcome = await settle(run({refetch}));

		expect(outcome).toBe('confirmed');
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it('4. unmount mid-poll aborts the loop — no refetch on a dead page', async () => {
		const refetch = vi.fn(async () => [] as Row[]);

		const {run, unmount} = mountReconciler();
		const pending = run({refetch, confirm: () => false});

		// Let the acceptance read and the first sleep begin, then leave the page.
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100);
		});
		const readsAtUnmount = refetch.mock.calls.length;
		unmount();

		const outcome = await settle(pending);
		expect(outcome).toBe('pending');
		expect(refetch).toHaveBeenCalledTimes(readsAtUnmount);
	});

	it('5. a second mutation supersedes the first — one live poll chain, not two', async () => {
		const refetchA = vi.fn(async () => [] as Row[]);
		const refetchB = vi.fn(async () => [{name: 'b'}] as Row[]);

		const {run} = mountReconciler();
		const first = run({refetch: refetchA, confirm: () => false});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(100);
		});
		const readsAtSupersede = refetchA.mock.calls.length;

		const second = run({refetch: refetchB, confirm: (rows: Row[]) => rows.some(r => r.name === 'b')});

		expect(await settle(first)).toBe('pending');
		expect(await settle(second)).toBe('confirmed');
		// The superseded chain stopped where it was.
		expect(refetchA).toHaveBeenCalledTimes(readsAtSupersede);
	});

	it('6. confirmation is semantic — server canonicalization is not a missing row (rule 6)', async () => {
		// Same rule, re-ordered, with the zero-valued field omitted entirely
		// and a null where the client sent []. Structural equality would call
		// this "never appeared" and poll out to a false pending.
		const canonicalized = [
			{name: 'other', port: 80},
			{name: 'svc-a', secondaryIPs: null}, // client sent {name:'svc-a', port:0, secondaryIPs:[]}
		];
		const refetch = vi.fn(async () => canonicalized as unknown as Row[]);

		const {run} = mountReconciler();
		const outcome = await settle(run({refetch, confirm: (rows: Row[]) => rows.some(r => r.name === 'svc-a')}));

		expect(outcome).toBe('confirmed');
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it('7. a transient refetch failure mid-loop is survivable, not fatal', async () => {
		let reads = 0;
		const refetch = vi.fn(async () => {
			reads += 1;
			if (reads === 1) throw Object.assign(new Error('Service Unavailable'), {status: 503});
			return [{name: 'svc-a'}] as Row[];
		});

		const {run} = mountReconciler();
		const outcome = await settle(run({refetch, confirm: (rows: Row[]) => rows.some(r => r.name === 'svc-a')}));

		expect(outcome).toBe('confirmed');
		expect(refetch.mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('8. the budget is bounded and ordered — no unbounded retry storm', async () => {
		// Pins the Q-2-provisional table itself: strictly increasing backoff,
		// a budget an operator will actually wait through.
		expect(DEFAULT_RECONCILE_INTERVALS_MS.length).toBeGreaterThanOrEqual(3);
		for (let i = 1; i < DEFAULT_RECONCILE_INTERVALS_MS.length; i++) {
			expect(DEFAULT_RECONCILE_INTERVALS_MS[i]).toBeGreaterThan(DEFAULT_RECONCILE_INTERVALS_MS[i - 1]);
		}
		const total = DEFAULT_RECONCILE_INTERVALS_MS.reduce((a, b) => a + b, 0);
		expect(total).toBeGreaterThanOrEqual(5_000);
		expect(total).toBeLessThanOrEqual(15_000);
	});

	it('9. a slow refetch does not stack concurrent reads', async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const refetch = vi.fn(async () => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise(r => setTimeout(r, 3_000)); // slower than the first intervals
			inFlight -= 1;
			return [] as Row[];
		});

		const {run} = mountReconciler();
		await settle(run({refetch, confirm: () => false}));

		expect(maxInFlight).toBe(1);
		expect(inFlight).toBe(0);
	});
});
