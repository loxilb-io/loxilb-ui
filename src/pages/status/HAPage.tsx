//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import HATable from 'components/table/status/HATable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useHAState} from 'hooks/query/queryHooks';
import {fromQueryRefetch} from 'hooks/query/reconcile';
import {useReconcileReporter} from 'hooks/query/reconcileReport';
import {useCallback, useRef, useState} from 'react';
import {IVipAttribute, IVipConfiguration} from 'types/ha';
import VipInputForm from 'components/input/VipInputForm';
import {usePopUp} from 'hooks/popupHook';
import {request_update_ha_state} from 'connector/instance/status';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HAPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useHAState(inst); // IVipAttribute[]
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	const ha_info: IVipConfiguration = {Attr: data ?? []};
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	const {openPopUp, enableYes} = usePopUp();
	const {reconcile} = useReconcileReporter();
	const instanceRef = useRef<IVipAttribute | null>(null);

	const handleEdit = useCallback(() => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedItem = ha_info.Attr[selected_rows[0]];
		
		const edit_form = (
			<VipInputForm
				key={Date.now()}
				initialData={selectedItem}
				onChange={(data: IVipAttribute & {isValid?: boolean}) => {
					instanceRef.current = data;
					enableYes(!!data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			edit_form,
			t('Update'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				const res = await request_update_ha_state(inst, instanceRef.current);
				if (res.status === 'confirmed') {
					// UI-P6-3 EXEMPT from poll-to-confirm (task doc 2.4): an HA state
					// change is inherently asynchronous — the cluster reports its own
					// progress through the HA status API, and this list cannot
					// distinguish "not converged yet" from "converged back". So the
					// blind 1 s timer is replaced by a single invalidating read, not
					// by a confirm poll that would guess at a verdict it cannot see.
					openPopUp(t('Success'), t('Updated successfully.'), t('OK'));
					await reconcile({refetch: fromQueryRefetch(refetch)});
				} else {
					openPopUp(t('Error'), t('Failed to update. {{error}}', {error: t(res.localeKey)}), t('OK'));
				}
			},
			true,
		);
	}, [inst, selected_rows, ha_info, openPopUp, refetch, enableYes, reconcile]);

	return <HATable data={ha_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onEdit={handleEdit} onRefresh={refetch} error={!!isError} />;
}
