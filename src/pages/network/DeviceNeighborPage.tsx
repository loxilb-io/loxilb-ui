//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress, getStableHash} from 'common';
import DeviceNeighborInputForm from 'components/input/DeviceNeighborInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import DeviceNeighborTable from 'components/table/networks/DeviceNeighborTable';
import {request_create_device_neighbor, request_delete_device_neighbor} from 'connector/instance/device_neghbors';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useDeviceNeighbors} from 'hooks/query/deviceHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import React from 'react';
import {INeighborAttr, INeighborData} from 'types/device_neighbor';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useDeviceNeighbors(inst); // INeighborAttr[]
	const neighbor_info: INeighborData = {neighborAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected dev/ipAddress for synchronization
   const [selected_key, set_selected_key] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   
   // Hash function for Device Neighbor entry
   const getHashKey = (item: any) => {
	   const str = `${item.dev || ''}_${item.ipAddress || ''}`;
	   return getStableHash(str);
   };
   
   // Sorted neighbor entries
   const sortedAttr = neighbor_info.neighborAttr ? [...neighbor_info.neighborAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && neighbor_info.neighborAttr) {
	   const original = neighbor_info.neighborAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_key) {
	   selected_index = sortedAttr.findIndex(attr => `${attr.dev}_${attr.ipAddress}` === selected_key);
   }
   
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && neighbor_info.neighborAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = neighbor_info.neighborAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };
	const handleDelete = async () => {
		if (!inst) return;

		const item = neighbor_info.neighborAttr[selected_rows[0]];
		const res = await request_delete_device_neighbor(inst, item.ipAddress, item.dev);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else showDeleteError('device neighbor', res.error);
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
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('device neighbor', res.error);
			},
			true,
		);
	};

   // Synchronize selected_key with selected_rows
   React.useEffect(() => {
	   if (!neighbor_info.neighborAttr || neighbor_info.neighborAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const item = neighbor_info.neighborAttr[selected_rows[0]];
		   set_selected_key(`${item.dev}_${item.ipAddress}`);
	   } else if (selected_key !== null) {
		   set_selected_key(null);
	   }
   }, [neighbor_info, selected_rows, selected_key]);

   return (
	   <>
		   <DeviceNeighborTable
			   data={{neighborAttr: sortedAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
			   onRefresh={refetch}
		   />

		   {/* Error Popup */}
		   <ErrorPopUp
			   isOpen={errorPopup.isOpen}
			   onClose={closeErrorPopup}
			   title={errorPopup.title}
			   mainMessage={errorPopup.mainMessage}
			   errorData={errorPopup.errorData}
			   buttonText={t('OK')}
		   />
	   </>
   );
}
