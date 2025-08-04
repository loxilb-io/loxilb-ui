//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BGPDefinedSetInputForm from 'components/input/BGPDefineSetInputForm';
import BGPDefinedSetTable from 'components/table/networks/BGPDefinedSetTable';
import {request_create_defined_set, request_delete_defined_set} from 'connector/instance/bgp';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBGPDefinedSets} from 'hooks/query/bgpHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IBGPDefinedSetInput, IDefinedSetsInfo} from 'types/bgp_defined_set';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinedSetPage() {
	const inst = useInstanceFromURL();

	const {data: prefix_data, refetch: refetch_prefix} = useBGPDefinedSets(inst, 'prefix'); // prefixList is avalable
	const {data: neighbor_data, refetch: refetch_neighbor} = useBGPDefinedSets(inst, 'neighbor'); // list is avalable
	const {data: aspath_data, refetch: refetch_aspath} = useBGPDefinedSets(inst, 'aspath'); // list is avalable
	const {data: community_data, refetch: refetch_comm} = useBGPDefinedSets(inst, 'community'); // list is avalable
	const {data: extcommunity_data, refetch: refetch_extcomm} = useBGPDefinedSets(inst, 'extcommunity'); // list is avalable
	const {data: largecommunity_data, refetch: refetch_largecomm} = useBGPDefinedSets(inst, 'largecommunity'); // list is avalable

	const set_data: IDefinedSetsInfo = {
		definedsetsAttr: [
			...(prefix_data ?? []),
			...(neighbor_data ?? []),
			...(aspath_data ?? []),
			...(community_data ?? []),
			...(extcommunity_data ?? []),
			...(largecommunity_data ?? []),
		],
	};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const refetch_data = (type: string) => {
		switch (type) {
			case 'prefix':
				refetch_prefix();
				break;
			case 'neighbor':
				refetch_neighbor();
				break;
			case 'aspath':
				refetch_aspath();
				break;
			case 'community':
				refetch_comm();
				break;
			case 'extcommunity':
				refetch_extcomm();
				break;
			case 'largecommunity':
				refetch_largecomm();
				break;
			default:
				break;
		}
	};

	const handleDelete = async () => {
		if (!inst) return;

		const item = set_data.definedsetsAttr[selected_rows[0]];
		const res = await request_delete_defined_set(inst, item.definedType, item.name);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch_data(item.definedType);
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IBGPDefinedSetInput | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<BGPDefinedSetInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data.name && data.name !== '');
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

				const res = await request_create_defined_set(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch_data(instanceRef.current.definedType);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return <BGPDefinedSetTable data={set_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} />;
}
