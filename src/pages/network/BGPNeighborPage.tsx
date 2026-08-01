//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash, isValidIPAddress} from 'common';
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

	const {data, isError, refetch} = useBGPNeighbors(inst); // IBgpNeighborAttribute[]
	// wire fields are optional in swagger; the table/delete flow requires them — narrow once here
	const bgp_neighbor_info: IBgpNeighborState = {bgpNeiAttr: (data ?? []) as IBgpNeighborAttribute[]};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleDelete = async () => {
		if (!inst || selected_rows.length === 0) return;

		const targets = selected_rows.map(hash => bgp_neighbor_info.bgpNeiAttr.find(n => getStableHash(String(n.ipAddress ?? '')) === hash)).filter((n): n is IBgpNeighborAttribute => n != null);
		const results = await Promise.all(targets.map(n => request_delete_bgp_neighbor(inst, n.ipAddress)));
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`}), t('OK'));
		} else {
			openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: failures[0].error}), t('OK'));
			return;
		}
		set_selected_rows([]);
		refetch();
	};

	const instanceRef = useRef<IBgpNeighborInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<BGPNeighborInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					// F-CICD-4 sibling: gate on address VALIDITY, not just presence —
					// a malformed peer IP ("999.1.1.1") must not reach the gateway.
					enableYes(isValidIPAddress(data.ipAddress ?? ''));
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

	return <BGPNeighborTable data={bgp_neighbor_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} error={isError} />;
}
