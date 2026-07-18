//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash, isValidMacAddress} from 'common';
import FdbInputForm from 'components/input/FDBInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import FDBTable from 'components/table/networks/FDBTable';
import {request_create_fdb, request_delete_fdb} from 'connector/instance/fdb';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useFDB} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import React from 'react';
import {IFdbAttribute, IFdbData} from 'types/fdb';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FDBPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useFDB(inst); // IFdbAttribute[]
	const fdb_info: IFdbData = {fdbAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected dev/macAddress for synchronization
   const [selected_key, set_selected_key] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   // Hash function for FDB entry
   const getHashKey = (item: any) => {
	   const str = `${item.dev || ''}_${item.macAddress || ''}`;
	   return getStableHash(str);
   };
   // Sorted FDB entries
   const sortedAttr = fdb_info.fdbAttr ? [...fdb_info.fdbAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && fdb_info.fdbAttr) {
	   const original = fdb_info.fdbAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_key) {
	   selected_index = sortedAttr.findIndex(attr => `${attr.dev}_${attr.macAddress}` === selected_key);
   }
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && fdb_info.fdbAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = fdb_info.fdbAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };
	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const results = await Promise.all(
			selected_rows.map(rowIndex => {
				const item = fdb_info.fdbAttr[rowIndex];
				return request_delete_fdb(inst, item.macAddress, item.dev);
			}),
		);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('FDB entry', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('FDB entry', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
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
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('FDB entry', res.error);
			},
			true,
		);
	};

   // Synchronize selected_key with selected_rows
   React.useEffect(() => {
	   if (!fdb_info.fdbAttr || fdb_info.fdbAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const item = fdb_info.fdbAttr[selected_rows[0]];
		   set_selected_key(`${item.dev}_${item.macAddress}`);
	   } else if (selected_key !== null) {
		   set_selected_key(null);
	   }
   }, [fdb_info, selected_rows, selected_key]);

   return (
	   <>
		   <FDBTable
			   data={{fdbAttr: sortedAttr}}
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
