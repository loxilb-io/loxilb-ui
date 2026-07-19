//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import HATable from 'components/table/status/HATable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useHAState} from 'hooks/query/queryHooks';
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

	const {data, refetch} = useHAState(inst); // IVipAttribute[]
	const ha_info: IVipConfiguration = {Attr: data ?? []};
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	const {openPopUp, enableYes} = usePopUp();
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
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					openPopUp(t('Error'), t('Failed to update. {{error}}', {error: res.error}), t('OK'));
				}
			},
			true,
		);
	}, [inst, selected_rows, ha_info, openPopUp, refetch, enableYes]);

	return <HATable data={ha_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onEdit={handleEdit} onRefresh={refetch} />;
}
