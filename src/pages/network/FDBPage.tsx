//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidMacAddress} from 'common';
import FdbInputForm from 'components/input/FDBInputForm';
import FDBTable from 'components/table/networks/FDBTable';
import {request_create_fdb, request_delete_fdb} from 'connector/instance/fdb';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useFDB} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IFdbAttribute, IFdbData} from 'types/fdb';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FDBPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useFDB(inst); // IFdbAttribute[]
	const fdb_info: IFdbData = {fdbAttr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<any[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);
	const handleDelete = async () => {
		if (!inst) return;

		const item = fdb_info.fdbAttr[selected_rows[0]];
		const res = await request_delete_fdb(inst, item.macAddress, item.dev);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IFdbAttribute | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<FdbInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(isValidMacAddress(data.macAddress));
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

				const res = await request_create_fdb(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return <FDBTable data={fdb_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />;
}
