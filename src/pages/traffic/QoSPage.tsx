//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash } from 'common';
import PolicyInputForm from 'components/input/PolicyInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import QoSTable from 'components/table/traffic/QoSTable';
import {request_create_qos_policy, request_delete_qos_policy} from 'connector/instance/qos';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useQOSPolicies} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useMemo, useRef, useState} from 'react';
import {IPolicyAttribute, IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useQOSPolicies(inst);
	const qos_info: IPolicyConfiguration = {polAttr: data ?? []};

   // Holds STABLE content-hash row ids (not array indices)
   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   // Hash function for QoS policy — MUST match QoSTable.getHashKey
   const getHashKey = (item: IPolicyAttribute) => {
	   const str = `${item.policyIdent || ''}_${item.policyInfo.type || ''}_${item.targetObject.attachment || ''}_${item.targetObject.polObjName || ''}`;
	   return getStableHash(str);
   };

   // Resolve selected items by matching stable hash ids against the raw data
   const selectedItems = useMemo(
	   () => selected_rows.map(h => qos_info.polAttr.find(a => getHashKey(a) === h)).filter((x): x is IPolicyAttribute => x != null),
	   [selected_rows, qos_info.polAttr],
   );
   const selectedItem: IPolicyAttribute | null = selectedItems.length === 1 ? selectedItems[0] : null;

   const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(selectedItems.map(item => request_delete_qos_policy(inst, item.policyIdent)));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('QoS policy', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('QoS policy', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const instanceRef = useRef<IPolicyAttribute | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<PolicyInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					// enableYes(!!data && data.policyIdent !== '');
					enableYes(data.isValid);
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

				const res = await request_create_qos_policy(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('QoS policy', res.error);
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
		   <QoSTable
			   data={qos_info}
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
