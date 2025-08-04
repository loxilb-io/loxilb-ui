//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress} from 'common';
import DeviceNeighborInputForm from 'components/input/DeviceNeighborInputForm';
import DeviceNeighborTable from 'components/table/networks/DeviceNeighborTable';
import {request_create_device_neighbor, request_delete_device_neighbor} from 'connector/instance/device_neghbors';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useDeviceNeighbors} from 'hooks/query/deviceHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {INeighborAttr, INeighborData} from 'types/device_neighbor';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useDeviceNeighbors(inst); // INeighborAttr[]
	const neighbor_info: INeighborData = {neighborAttr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<any[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);
	const handleDelete = async () => {
		if (!inst) return;

		const item = neighbor_info.neighborAttr[selected_rows[0]];
		const res = await request_delete_device_neighbor(inst, item.ipAddress, item.dev);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<INeighborAttr | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<DeviceNeighborInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(isValidIPAddress(data.ipAddress));
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

				const res = await request_create_device_neighbor(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return <DeviceNeighborTable data={neighbor_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />;
}
