//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { getStableHash } from 'common';
import VLanInputForm from 'components/input/VLanInputForm';
import VLanMemberInputForm from 'components/input/VLanMemberInputForm';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import VLANMemberTable from 'components/table/networks/VLANMemberTable';
import VLANTable from 'components/table/networks/VLANTable';
import {request_add_vlan_member, request_create_vlan, request_delete_vlan, request_delete_vlan_member} from 'connector/instance/vlan';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useVLANAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useMemo, useRef, useState} from 'react';
import {IMember, IVlanAttribute, IVlanData, IVlanInput, IVlanMemberInput} from 'types/vlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function MemberView(props: {name: string; vid: number; data: IMember[]; refetch: () => void}) {
	const {name, vid, data, refetch} = props;

	const inst = useInstanceFromURL();
	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds stable hash ids
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	// Hash function for VLAN member (must match VLANMemberTable's getHashKey)
	const getHashKey = (item: IMember) => getStableHash(`${item.dev || ''}_${item.tagged ? 'tagged' : 'untagged'}`);

	// Resolve selected members by matching the stable hash
	const selectedItems = useMemo(
		() => selected_rows.map(h => data.find(a => getHashKey(a) === h)).filter((x): x is IMember => x != null),
		[selected_rows, data],
	);

	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(
			selectedItems.map(member => {
				// The gateway lists a tagged member as "<dev>.<vid>" (e.g. eth0.3999)
				// but its delete endpoint expects the base device name — passing the
				// suffixed name 404s and the member is undeletable. Strip the suffix.
				const baseDev = member.dev.endsWith(`.${vid}`) ? member.dev.slice(0, member.dev.length - `.${vid}`.length) : member.dev;
				return request_delete_vlan_member(inst, vid, baseDev, member.tagged);
			}),
		);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('VLAN member', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('VLAN member', failures[0].error);
			return;
		}
		set_selected_rows([]);
		refetch();
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
				} else showAddError('VLAN member', res.error);
			},
			true,
		);
	};

	return (
		<>
			<SubTitlePannel title={name} sub_title={t('Members')}>
				<VLANMemberTable data={data} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} onRefresh={refetch} />
			</SubTitlePannel>
			
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

export default function VLANPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useVLANAttr(inst); // IVlanAttribute[]
	const vlan_info: IVlanData = {vlanAttr: data ?? []};

   const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds stable hash ids
   const {openPopUp, enableYes} = usePopUp();
   const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

   // Hash function for VLAN (must match VLANTable's getHashKey)
   const getHashKey = (item: any) => getStableHash(`${item.vid || ''}_${item.dev || ''}`);

   // Resolve selected VLANs by matching the stable hash
   const selectedItems = useMemo(
	   () => selected_rows.map(h => vlan_info.vlanAttr.find(a => getHashKey(a) === h)).filter((x): x is IVlanAttribute => x != null),
	   [selected_rows, vlan_info.vlanAttr],
   );
   const selectedItem: IVlanAttribute | null = selectedItems.length === 1 ? selectedItems[0] : null;

   const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	const handleDelete = async () => {
		if (!inst || selectedItems.length === 0) return;

		const results = await Promise.all(selectedItems.map(item => request_delete_vlan(inst, item.vid)));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('VLAN', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('VLAN', failures[0].error);
			return;
		}
		set_selected_rows([]);
		setTimeout(() => {
			refetch();
		}, 1000);
	};

	const instanceRef = useRef<IVlanInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<VLanInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					// 802.1Q vid range; the gateway creates a bridge for any number.
					enableYes(!!data.vid && data.vid >= 1 && data.vid <= 4094);
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
				} else showAddError('VLAN', res.error);
			},
			true,
		);
	};

   return (
	   <Fragment>
		   <VLANTable
			   data={vlan_info}
			   selected_rows={selected_rows}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
			   onRefresh={refetch}
			   error={isError}
		   />
		   {selectedItem && (
			   <LowerSection>
				   <MemberView
					   name={selectedItem.dev}
					   vid={selectedItem.vid}
					   data={selectedItem.member}
					   refetch={refetch}
				   />
			   </LowerSection>
		   )}

		   {/* Error Popup */}
		   <ErrorPopUp
			   isOpen={errorPopup.isOpen}
			   onClose={closeErrorPopup}
			   title={errorPopup.title}
			   mainMessage={errorPopup.mainMessage}
			   errorData={errorPopup.errorData}
			   buttonText={t('OK')}
		   />
	   </Fragment>
   );
}
