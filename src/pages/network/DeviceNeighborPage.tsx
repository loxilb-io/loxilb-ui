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
import {useMemo, useRef, useState} from 'react';
import {INeighborAttr, INeighborData} from 'types/device_neighbor';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useDeviceNeighbors(inst); // INeighborAttr[]
	const neighbor_info: INeighborData = {neighborAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds hash ids
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

   // Hash function for Device Neighbor entry
   const getHashKey = (item: any) => {
	   const str = `${item.dev || ''}_${item.ipAddress || ''}`;
	   return getStableHash(str);
   };

   // Resolve selected items by matching the stable hash
   const selectedItems = useMemo(
	   () => selected_rows.map(h => neighbor_info.neighborAttr.find(a => getHashKey(a) === h)).filter((x): x is INeighborAttr => x != null),
	   [selected_rows, neighbor_info.neighborAttr],
   );

   // Selection handler: page holds hash ids directly
   const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);
	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(
			selectedItems.map(item => {
				return request_delete_device_neighbor(inst, item.ipAddress, item.dev);
			}),
		);
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('device neighbor', t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)}));
		} else {
			showDeleteError('device neighbor', t(failures[0].localeKey));
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
					// A static neighbor is an IP→MAC binding, so the MAC must be
					// well-formed too — the gate once ignored it entirely.
					// The device is equally required: the gateway resolves it by name
					// and an empty one just fails the create.
					enableYes(isValidIPAddress(data.ipAddress) && isValidMacAddress(data.macAddress ?? '') && !!data.dev?.trim());
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('device neighbor', t(res.localeKey));
			},
			true,
		);
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

   return (
	   <>
		   <DeviceNeighborTable
			   data={neighbor_info}
			   selected_rows={selected_rows}
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
