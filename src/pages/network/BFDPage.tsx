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
import {useMemo, useRef, useState} from 'react';
import {IBFDAttribute, IBFDAttribureInfo, IBfdInput} from 'types/bfd';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BFDPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useBFD(inst); // IBFDAttribute[]
	const attr_info: IBFDAttribureInfo = {Attr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds hash ids
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

   // Hash function for BFD entry
   const getHashKey = (item: any) => {
	   const str = `${item.instance || ''}_${item.remoteIp || ''}_${item.sourceIP || ''}_${item.port || ''}`;
	   return getStableHash(str);
   };

   // Resolve selected items by matching the stable hash
   const selectedItems = useMemo(
	   () => selected_rows.map(h => attr_info.Attr.find(a => getHashKey(a) === h)).filter((x): x is IBFDAttribute => x != null),
	   [selected_rows, attr_info.Attr],
   );

   // Selection handler: page holds hash ids directly
   const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(selectedItems.map(item => request_delete_bfd(inst, item.remoteIp)));
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('BFD entry', t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)}));
		} else {
			showDeleteError('BFD entry', t(failures[0].localeKey));
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
			   if (res.status === 'confirmed') {
				   openPopUp(t('Success'), t('Added successfully.'), t('OK'));
				   setTimeout(() => {
						refetch();
					}, 1000);
			   } else showAddError('BFD entry', t(res.localeKey));
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
		   <BFDTable
			   data={attr_info}
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
