//---------------------------------------------------------
// reporting half of bounded reconciliation.
//
// Kept out of `reconcile.ts` so the reconciler itself stays a pure hook with
// no popup or i18n dependency (its unit matrix mounts it without providers).
// This is the piece the 11 Tranche-A call sites share, so the truthful
// wording exists once instead of eleven times.
//---------------------------------------------------------
import {t} from 'i18next';
import {useCallback} from 'react';
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
 */
export function useReconcileReporter() {
	const {openPopUp} = usePopUp();
	const reconcile = useReconciler();

	const report = useCallback(
		async function report<T>(spec: ReconcileSpec<T>, confirmedMessage: string): Promise<ReconcileOutcome> {
			const outcome = await reconcile(spec);
			if (outcome === 'confirmed') openPopUp(t('Success'), confirmedMessage, t('OK'));
			else openPopUp(t('Submitted'), t('The gateway accepted the change, but it has not appeared yet. Refresh to check again.'), t('OK'));
			return outcome;
		},
		[openPopUp, reconcile],
	);

	// Both come from ONE reconciler instance, so a mutation reported with a
	// popup and one reconciled silently still supersede each other correctly.
	// `reconcile` is for paths that have already said their piece — the
	// partial-failure branches, where an error popup is up and a second
	// popup on top of it would be noise.
	return {report, reconcile};
}
