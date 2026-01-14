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
import {useRef, useState} from 'react';
import React from 'react';
import {IPolicyAttribute, IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function QoSPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useQOSPolicies(inst);
	const qos_info: IPolicyConfiguration = {polAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected policy for synchronization
   const [selected_policyIdent, set_selected_policyIdent] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
   // Hash function for QoS policy
   const getHashKey = (item: IPolicyAttribute) => {
	   const str = `${item.policyIdent || ''}_${item.policyInfo.type || ''}_${item.targetObject.attachment || ''}_${item.targetObject.polObjName || ''}`;
	   return getStableHash(str);
   };
   // Sorted policies
   const sortedAttr = qos_info.polAttr ? [...qos_info.polAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   
   // Map selected original indices to sorted indices for display
   const selectedSortedIndices = React.useMemo(() => {
	   if (!qos_info.polAttr || selected_rows.length === 0) return [];
	   
	   return selected_rows
		   .map(originalIdx => {
			   const original = qos_info.polAttr[originalIdx];
			   return sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
		   })
		   .filter(idx => idx !== -1);
   }, [selected_rows, qos_info.polAttr, sortedAttr]);

   // Find single selected index for detail panel
   const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
	   (selected_policyIdent ? sortedAttr.findIndex(attr => attr.policyIdent === selected_policyIdent) : -1);

   // Selection handler: map sorted indices back to original indices
   const handleSelectionChange = (indices: number[]) => {
	   if (!qos_info.polAttr) {
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
			   return qos_info.polAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   })
		   .filter(idx => idx !== -1);

	   set_selected_rows(originalIndices);
   };
	const handleDelete = async () => {
		if (!inst) return;

		const item = qos_info.polAttr[selected_rows[0]];

		const res = await request_delete_qos_policy(inst, item.policyIdent);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else showDeleteError('QoS policy', res.error);
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
		set_selected_policyIdent(null);
		refetch();
	};

   React.useEffect(() => {
	   if (!qos_info.polAttr || qos_info.polAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const policyIdent = qos_info.polAttr[selected_rows[0]].policyIdent;
		   set_selected_policyIdent(policyIdent);
	   } else if (selected_policyIdent !== null) {
		   set_selected_policyIdent(null);
	   }
   }, [qos_info, selected_rows, selected_policyIdent]);

   return (
	   <>
		   <QoSTable
			   data={{polAttr: sortedAttr}}
			   selected_rows={selectedSortedIndices}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
			   onRefresh={handleRefresh}
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
