//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash } from 'common';
import VLanInputForm from 'components/input/VLanInputForm';
import VLanMemberInputForm from 'components/input/VLanMemberInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import VLANMemberTable from 'components/table/networks/VLANMemberTable';
import VLANTable from 'components/table/networks/VLANTable';
import {request_add_vlan_member, request_create_vlan, request_delete_vlan, request_delete_vlan_member} from 'connector/instance/vlan';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useVLANAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import React from 'react';
import {Fragment, useRef, useState} from 'react';
import {IMember, IVlanData, IVlanInput, IVlanMemberInput} from 'types/vlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function MemberView(props: {name: string; vid: number; data: IMember[]; refetch: () => void}) {
	const {name, vid, data, refetch} = props;

	const inst = useInstanceFromURL();
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: number[]) => set_selected_rows(selection);

	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const member = data[selected_rows[0]];
		const res = await request_delete_vlan_member(inst, vid, member.dev, member.tagged);

		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IVlanMemberInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<VLanMemberInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data.dev && data.dev !== '');
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

				const res = await request_add_vlan_member(inst, vid, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return (
		<SubTitlePannel title={name} sub_title={t('Members')}>
			<VLANMemberTable data={data} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />
		</SubTitlePannel>
	);
}

export default function VLANPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useVLANAttr(inst); // IVlanAttribute[]
	const vlan_info: IVlanData = {vlanAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected vid for synchronization
   const [selected_vid, set_selected_vid] = useState<number | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   // Hash function for VLAN
   const getHashKey = (item: any) => {
	   const str = `${item.vid || ''}_${item.dev || ''}`;
	   return getStableHash(str);
   };
   // Sorted VLANs
   const sortedAttr = vlan_info.vlanAttr ? [...vlan_info.vlanAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && vlan_info.vlanAttr) {
	   const original = vlan_info.vlanAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_vid !== null) {
	   selected_index = sortedAttr.findIndex(attr => attr.vid === selected_vid);
   }
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && vlan_info.vlanAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = vlan_info.vlanAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };

	const handleDelete = async () => {
		if (!inst) return;

		const item = vlan_info.vlanAttr[selected_rows[0]];
		const res = await request_delete_vlan(inst, item.vid);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IVlanInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<VLanInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data.vid && data.vid > 0);
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

				const res = await request_create_vlan(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					// Wait 1 second before refetching to allow backend to apply changes
					setTimeout(() => {
						refetch();
					}, 1000);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

   // Synchronize selected_vid with selected_rows
   React.useEffect(() => {
	   if (!vlan_info.vlanAttr || vlan_info.vlanAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const vid = vlan_info.vlanAttr[selected_rows[0]].vid;
		   set_selected_vid(vid);
	   } else if (selected_vid !== null) {
		   set_selected_vid(null);
	   }
   }, [vlan_info, selected_rows, selected_vid]);

   return (
	   <Fragment>
		   <VLANTable
			   data={{vlanAttr: sortedAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
		   />
		   {selected_index !== -1 && (
			   <LowerSection>
				   <MemberView
					   name={sortedAttr[selected_index].dev}
					   vid={sortedAttr[selected_index].vid}
					   data={sortedAttr[selected_index].member}
					   refetch={refetch}
				   />
			   </LowerSection>
		   )}
	   </Fragment>
   );
}
