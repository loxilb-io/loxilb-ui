//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress} from 'common';
import BFDInputForm from 'components/input/BFDInputForm';
import BFDTable from 'components/table/networks/BFDTable';
import {request_create_bfd, request_delete_bfd} from 'connector/instance/bfd';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBFD} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IBFDAttribureInfo, IBfdInput} from 'types/bfd';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BFDPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useBFD(inst); // IBFDAttribute[]
	const attr_info: IBFDAttribureInfo = {Attr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleDelete = async () => {
		if (!inst) return;

		const item = attr_info.Attr[selected_rows[0]];
		const res = await request_delete_bfd(inst, item.remoteIp);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IBfdInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<BFDInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(isValidIPAddress(data.remoteIp ?? ''));
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				const res = await request_create_bfd(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return <BFDTable data={attr_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} />;
}
