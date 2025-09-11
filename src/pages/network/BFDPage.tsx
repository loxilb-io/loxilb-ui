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

	const {data, refetch} = useBFD(inst); // IBFDAttribute[]
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
   
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && attr_info.Attr) {
	   const original = attr_info.Attr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_key) {
	   selected_index = sortedAttr.findIndex(attr => `${attr.instance}_${attr.remoteIp}_${attr.sourceIP}_${attr.port}` === selected_key);
   }
   
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && attr_info.Attr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = attr_info.Attr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };
	const handleDelete = async () => {
		if (!inst) return;

		const item = attr_info.Attr[selected_rows[0]];
		const res = await request_delete_bfd(inst, item.remoteIp);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else showDeleteError('BFD entry', res.error);
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
