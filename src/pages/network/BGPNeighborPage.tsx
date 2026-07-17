//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BGPNeighborInputForm from 'components/input/BGPNeighborInputForm';
import BGPNeighborTable from 'components/table/networks/BGPNeighborTable';
import {request_create_bgp_neighbor, request_delete_bgp_neighbor} from 'connector/instance/bgp';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBGPNeighbors} from 'hooks/query/bgpHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IBgpNeighborAttribute, IBgpNeighborInput, IBgpNeighborState} from 'types/bgp_neighbor';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPNeighborPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useBGPNeighbors(inst); // IBgpNeighborAttribute[]
	// wire fields are optional in swagger; the table/delete flow requires them — narrow once here
	const bgp_neighbor_info: IBgpNeighborState = {bgpNeiAttr: (data ?? []) as IBgpNeighborAttribute[]};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleDelete = async () => {
		if (!inst) return;

		const item = bgp_neighbor_info.bgpNeiAttr[selected_rows[0]];
		const res = await request_delete_bgp_neighbor(inst, item.ipAddress);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IBgpNeighborInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<BGPNeighborInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data.ipAddress && data.ipAddress !== '');
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

				const res = await request_create_bgp_neighbor(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return <BGPNeighborTable data={bgp_neighbor_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} />;
}
