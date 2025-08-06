//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress, getStableHash} from 'common';
import BFDInputForm from 'components/input/BFDInputForm';
import BFDTable from 'components/table/networks/BFDTable';
import {request_create_bfd, request_delete_bfd} from 'connector/instance/bfd';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
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
   const {openPopUp, enableYes} = usePopUp();
   // Use global hash function for BFD entry
   const getHashKey = (item: any) => getStableHash(`${item.instance || ''}_${item.remoteIp || ''}_${item.sourceIP || ''}_${item.port || ''}`);
   // Selection handler: synchronize using hash-based indices
   const handleSelectionChange = (selection: number[]) => set_selected_rows(selection);
   const handleDelete = async () => {
	   if (!inst || selected_rows.length === 0) return;
	   // Find the item by hash
	   const selectedHash = selected_rows[0];
	   const item = attr_info.Attr.find(
		   (row: any) => getHashKey(row) === selectedHash
	   );
	   if (!item) return;
	   const res = await request_delete_bfd(inst, item.remoteIp);
	   if (res.status === 'success') {
		   openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
		   set_selected_rows([]);
		   setTimeout(() => {
				refetch();
			}, 1000);
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
				   setTimeout(() => {
						refetch();
					}, 1000);
			   } else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
		   },
		   true,
	   );
   };


   return <BFDTable data={attr_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />;
}
