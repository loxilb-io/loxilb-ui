//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Stack} from '@mui/material';
import ChipField from 'components/element/ChipField';
import SubTitleBar from 'components/element/SubTitleBar';
import VxlanInputForm from 'components/input/VXLanInputForm';
import VxlanPeerInputForm from 'components/input/VXLanPeerInputForm';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import VXLANTable from 'components/table/networks/VXLANTable';
import {request_add_vxlan_peer, request_create_vxlan, request_delete_vxlan, request_delete_vxlan_peer} from 'connector/instance/vxlan';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useVxlanAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState} from 'react';
import {getStableHash} from 'common';
import {IVxlanAttribute, IVxlanData, IVxlanInput} from 'types/vxlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function PeerPanel(props: {name: string; vxlanID: number; data: string[]; refetch: () => void}) {
	const {name, vxlanID, data, refetch} = props;
	const inst = useInstanceFromURL();
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	const handleDelete = async (peerIP: string) => {
		if (!inst) return;

		const res = await request_delete_vxlan_peer(inst, vxlanID, peerIP);

		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			refetch();
		} else showDeleteError('VXLAN peer', res.error);
	};

	const peerRef = useRef<string>('');
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<VxlanPeerInputForm
				value={peerRef.current}
				onChange={data => {
					peerRef.current = data;
					enableYes(!!data && data !== '');
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!peerRef.current) return;

				const res = await request_add_vxlan_peer(inst, vxlanID, peerRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Created successfully.'), t('OK'));
					refetch();
				} else showAddError('VXLAN peer', res.error);
			},
			true,
		);
	};

	return (
		<>
			<Stack spacing={2}>
				<SubTitleBar title={name} sub_title={t('Peer IPs')} />

				<Box display="flex" justifyContent="flex-end">
					<Button size="small" variant="outlined" onClick={handleAdd}>
						{t('Add')}
					</Button>
				</Box>

				<ChipField label={t('Values')} item_list={data} onDelete={handleDelete} />
			</Stack>
			
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

export default function VxLANPage() {
	const inst = useInstanceFromURL();

	const {data, isError, refetch} = useVxlanAttr(inst); // IVxlanAttribute[]
	const vxlan_info: IVxlanData = {vxlanAttr: data ?? []};

	// selected_rows holds a stable hash of vxlanID (the row id the table
	// assigns), so selection tracks the VXLAN across refetches, not array order.
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();

	const selectedVxlan = selected_rows.length === 1 ? vxlan_info.vxlanAttr.find(v => getStableHash(String(v.vxlanID ?? '')) === selected_rows[0]) ?? null : null;

	const handleSelectionChange = (selection: number[]) => set_selected_rows(selection);
	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const targets = selected_rows.map(hash => vxlan_info.vxlanAttr.find(v => getStableHash(String(v.vxlanID ?? '')) === hash)).filter((v): v is IVxlanAttribute => v != null);
		const results = await Promise.all(targets.map(v => request_delete_vxlan(inst, v.vxlanID)));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			showDeleteError('VXLAN', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
		} else {
			showDeleteError('VXLAN', failures[0].error);
			return;
		}
		set_selected_rows([]);
		refetch();
	};

	const instanceRef = useRef<IVxlanInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<VxlanInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(data.vxlanID > 0);
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

				const res = await request_create_vxlan(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else showAddError('VXLAN', res.error);
			},
			true,
		);
	};

	return (
		<Fragment>
			<VXLANTable data={vxlan_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} error={isError} />

			{selectedVxlan && (
				<LowerSection>
					<PeerPanel
						name={selectedVxlan.vxlanName}
						data={selectedVxlan.peerIP}
						vxlanID={selectedVxlan.vxlanID}
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
