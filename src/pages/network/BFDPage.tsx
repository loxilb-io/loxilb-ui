//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress, getStableHash} from 'common';
import BFDInputForm from 'components/input/BFDInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import BFDTable from 'components/table/networks/BFDTable';
import {request_create_bfd, request_delete_bfd} from 'connector/instance/bfd';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useBFD} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import React from 'react';
import {IBFDAttribureInfo, IBfdInput} from 'types/bfd';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BFDPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useBFD(inst); // IBFDAttribute[]
	const attr_info: IBFDAttribureInfo = {Attr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected BFD entry key for synchronization
   const [selected_key, set_selected_key] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   
   // Hash function for BFD entry
   const getHashKey = (item: any) => {
	   const str = `${item.instance || ''}_${item.remoteIp || ''}_${item.sourceIP || ''}_${item.port || ''}`;
	   return getStableHash(str);
   };
   
   // Sorted BFD entries
   const sortedAttr = attr_info.Attr ? [...attr_info.Attr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   
   // Map selected original indices to sorted indices for display
   const selectedSortedIndices = React.useMemo(() => {
	   if (!attr_info.Attr || selected_rows.length === 0) return [];
	   
	   return selected_rows
		   .map(originalIdx => {
			   const original = attr_info.Attr[originalIdx];
			   return sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
		   })
		   .filter(idx => idx !== -1);
   }, [selected_rows, attr_info.Attr, sortedAttr]);

   // Find single selected index for detail panel
   const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
	   (selected_key ? sortedAttr.findIndex(attr => `${attr.instance}_${attr.remoteIp}_${attr.sourceIP}_${attr.port}` === selected_key) : -1);

   // Selection handler: map sorted indices back to original indices
   const handleSelectionChange = (indices: number[]) => {
	   if (!attr_info.Attr) {
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
			   return attr_info.Attr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   })
		   .filter(idx => idx !== -1);

	   set_selected_rows(originalIndices);
   };
	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const results = await Promise.all(selected_rows.map(rowIndex => request_delete_bfd(inst, attr_info.Attr[rowIndex].remoteIp)));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('BFD entry', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('BFD entry', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
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
				   setTimeout(() => {
						refetch();
					}, 1000);
			   } else showAddError('BFD entry', res.error);
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
	   if (!attr_info.Attr || attr_info.Attr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const item = attr_info.Attr[selected_rows[0]];
		   set_selected_key(`${item.instance}_${item.remoteIp}_${item.sourceIP}_${item.port}`);
	   } else if (selected_key !== null) {
		   set_selected_key(null);
	   }
   }, [attr_info, selected_rows, selected_key]);

   return (
	   <>
		   <BFDTable
			   data={{Attr: sortedAttr}}
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
