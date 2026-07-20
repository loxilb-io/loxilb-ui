//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress, isValidMacAddress, getStableHash} from 'common';
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

	const {data, isError, refetch} = useDeviceNeighbors(inst); // INeighborAttr[]
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
   
   // Map selected original indices to sorted indices for display
   const selectedSortedIndices = React.useMemo(() => {
	   if (!neighbor_info.neighborAttr || selected_rows.length === 0) return [];
	   
	   return selected_rows
		   .map(originalIdx => {
			   const original = neighbor_info.neighborAttr[originalIdx];
			   return sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
		   })
		   .filter(idx => idx !== -1);
   }, [selected_rows, neighbor_info.neighborAttr, sortedAttr]);

   // Find single selected index for detail panel
   const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
	   (selected_key ? sortedAttr.findIndex(attr => `${attr.dev}_${attr.ipAddress}` === selected_key) : -1);

   // Selection handler: map sorted indices back to original indices
   const handleSelectionChange = (indices: number[]) => {
	   if (!neighbor_info.neighborAttr) {
		   set_selected_rows([]);
		   return;
	   }

	   if (indices.length === 0) {
		   set_selected_rows([]);
		   return;
	   }

	   // Map each sorted index back to original index
	   const originalIndices = indices
		   .map(sortedIdx => {
			   const sortedItem = sortedAttr[sortedIdx];
			   return neighbor_info.neighborAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   })
		   .filter(idx => idx !== -1);

	   set_selected_rows(originalIndices);
   };
	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const results = await Promise.all(
			selected_rows.map(rowIndex => {
				const item = neighbor_info.neighborAttr[rowIndex];
				return request_delete_device_neighbor(inst, item.ipAddress, item.dev);
			}),
		);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('device neighbor', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('device neighbor', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const instanceRef = useRef<INeighborAttr | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<DeviceNeighborInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					// F-CICD-4 sibling: a static neighbor is an IP→MAC binding, so the
					// MAC must be well-formed too — the gate ignored it entirely.
					enableYes(isValidIPAddress(data.ipAddress) && isValidMacAddress(data.macAddress ?? ''));
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

	const handleRefresh = () => {
		set_selected_rows([]);
		set_selected_key(null);
		refetch();
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
			   selected_rows={selectedSortedIndices}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
		   onRefresh={handleRefresh}
		   error={isError}
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
