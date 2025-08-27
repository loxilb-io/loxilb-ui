//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash } from 'common';
import PolicyInputForm from 'components/input/PolicyInputForm';
import QoSTable from 'components/table/traffic/QoSTable';
import {request_create_qos_policy, request_delete_qos_policy} from 'connector/instance/qos';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
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
   // Hash function for QoS policy
   const getHashKey = (item: IPolicyAttribute) => {
	   const str = `${item.policyIdent || ''}_${item.policyInfo.type || ''}_${item.targetObject.attachment || ''}_${item.targetObject.polObjName || ''}`;
	   return getStableHash(str);
   };
   // Sorted policies
   const sortedAttr = qos_info.polAttr ? [...qos_info.polAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && qos_info.polAttr) {
	   const original = qos_info.polAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_policyIdent) {
	   selected_index = sortedAttr.findIndex(attr => attr.policyIdent === selected_policyIdent);
   }
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && qos_info.polAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = qos_info.polAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
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
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
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
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
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

   return <QoSTable
	   data={{polAttr: sortedAttr}}
	   selected_rows={selected_index !== -1 ? [selected_index] : []}
	   onChangeSelectedRows={handleSelectionChange}
	   onAdd={handleAdd}
	   onDelete={handleDelete}
	   onRefresh={refetch}
   />;
}
