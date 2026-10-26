//---------------------------------------------------------
// reporting half of bounded reconciliation.
//
// Kept out of `reconcile.ts` so the reconciler itself stays a pure hook with
// no popup or i18n dependency (its unit matrix mounts it without providers).
// This is the piece the 11 Tranche-A call sites share, so the truthful
// wording exists once instead of eleven times.
//---------------------------------------------------------
import {t} from 'i18next';
import {useCallback, useEffect, useRef} from 'react';
import {usePopUp} from 'hooks/popupHook';
import {ReconcileOutcome, ReconcileSpec, useReconciler} from './reconcile';

/**
 * Reconcile, then report what actually happened.
 *
 * `confirmed` keeps the operation's existing success wording. `pending` says
 * so plainly: the gateway accepted the write but it has not appeared within
 * the poll budget. That is not an error — no error popup, no red banner, and
 * nothing is blocked — but it must not be dressed up as success either,
 * which is exactly what the old immediate success popup did.
 *
 * `pending` has two different causes and the operator is told which. If the
 * last confirmation read came back and did not show the change, the change
 * "has not appeared yet". If the last read FAILED, nothing was learned about
 * the change at all, and saying it "has not appeared" would be a claim about
 * state nobody saw. Neither case repeats the write: the only way forward
 * offered is to refresh and look.
 */
export function useReconcileReporter() {
	const {openPopUp} = usePopUp();
	const reconcileRaw = useReconciler();
	const mounted = useRef(true);
	const generation = useRef({value: 0});
	useEffect(() => {
		mounted.current = true;
		const lifetime = generation.current;
		return () => {mounted.current = false; lifetime.value++;};
	}, []);

	const reconcile = useCallback(async function reconcile<T>(spec: ReconcileSpec<T>): Promise<ReconcileOutcome> {
		generation.current.value++;
		return reconcileRaw(spec);
	}, [reconcileRaw]);

	const report = useCallback(
		async function report<T>(spec: ReconcileSpec<T>, confirmedMessage: string): Promise<ReconcileOutcome> {
			const current = ++generation.current.value;
			let lastReadFailed = false;
			const outcome = await reconcileRaw({
				...spec,
				refetch: async () => {
					try {
						const latest = await spec.refetch();
						lastReadFailed = latest === undefined;
						return latest;
					} catch (error) {
						lastReadFailed = true;
						throw error;
					}
				},
			});
			// A cancelled poll still resolves as pending. It must not resurrect
			// a popup on another page or overwrite a newer operation's result.
			if (!mounted.current || current !== generation.current.value) return outcome;
			if (outcome === 'confirmed') openPopUp(t('Success'), confirmedMessage, t('OK'));
			else if (lastReadFailed) openPopUp(t('Submitted'), t('The gateway accepted the change, but it could not be read back to confirm it. Refresh to check again.'), t('OK'));
			else openPopUp(t('Submitted'), t('The gateway accepted the change, but it has not appeared yet. Refresh to check again.'), t('OK'));
			return outcome;
		},
		[openPopUp, reconcileRaw],
	);

	// Both come from ONE reconciler instance, so a mutation reported with a
	// popup and one reconciled silently still supersede each other correctly.
	// `reconcile` is for paths that have already said their piece — the
	// partial-failure branches, where an error popup is up and a second
	// popup on top of it would be noise.
	return {report, reconcile};
}
