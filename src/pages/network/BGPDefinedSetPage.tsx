//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import BGPDefinedSetInputForm from 'components/input/BGPDefineSetInputForm';
import BGPDefinedSetTable from 'components/table/networks/BGPDefinedSetTable';
import {request_create_defined_set, request_delete_defined_set} from 'connector/instance/bgp';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBGPDefinedSets} from 'hooks/query/bgpHooks';
import {t} from 'i18next';
import {useRef, useState} from 'react';
import {IBGPDefinedSetInput, IDefinedSetAttribute, IDefinedSetsInfo} from 'types/bgp_defined_set';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinedSetPage() {
	const inst = useInstanceFromURL();

	const {data: prefix_data, isError: prefix_error, refetch: refetch_prefix} = useBGPDefinedSets(inst, 'prefix'); // prefixList is avalable
	const {data: neighbor_data, isError: neighbor_error, refetch: refetch_neighbor} = useBGPDefinedSets(inst, 'neighbor'); // list is avalable
	const {data: aspath_data, isError: aspath_error, refetch: refetch_aspath} = useBGPDefinedSets(inst, 'aspath'); // list is avalable
	const {data: community_data, isError: community_error, refetch: refetch_comm} = useBGPDefinedSets(inst, 'community'); // list is avalable
	const {data: extcommunity_data, isError: extcommunity_error, refetch: refetch_extcomm} = useBGPDefinedSets(inst, 'extcommunity'); // list is avalable
	const {data: largecommunity_data, isError: largecommunity_error, refetch: refetch_largecomm} = useBGPDefinedSets(inst, 'largecommunity'); // list is avalable

	const isError = prefix_error || neighbor_error || aspath_error || community_error || extcommunity_error || largecommunity_error;

	// The gateway response does not carry definedType — each list is tagged
	// here with the type it was queried by (delete/refetch route on it).
	const tag_defined_type = (
		rows: {name: string; prefixList?: {ipPrefix?: string; masklengthRange?: string}[]; list?: string[]}[] | undefined,
		definedType: IDefinedSetAttribute['definedType'],
	): IDefinedSetAttribute[] =>
		(rows ?? []).map(d => ({
			name: d.name,
			definedType,
			prefixList: (d.prefixList ?? []).map(p => ({ipPrefix: p.ipPrefix ?? '', masklengthRange: p.masklengthRange ?? ''})),
			list: d.list ?? [],
		}));

	const set_data: IDefinedSetsInfo = {
		definedsetsAttr: [
			...tag_defined_type(prefix_data, 'prefix'),
			...tag_defined_type(neighbor_data, 'neighbor'),
			...tag_defined_type(aspath_data, 'aspath'),
			...tag_defined_type(community_data, 'community'),
			...tag_defined_type(extcommunity_data, 'extcommunity'),
			...tag_defined_type(largecommunity_data, 'largecommunity'),
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
		if (!inst || selected_rows.length === 0) return;

		// selected_rows carries the stable hash of the group NAME (see
		// BGPDefinedSetTable). Resolve it back to every defined-set that shares
		// that name (a name can span types), and delete each by (type, name) —
		// the old code indexed the flat array by the grouped row index, which
		// deleted an unrelated entry.
		const targets = selected_rows.flatMap(hash => set_data.definedsetsAttr.filter(d => getStableHash(d.name) === hash));
		const results = await Promise.all(targets.map(item => request_delete_defined_set(inst, item.definedType, item.name)));
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
		for (const definedType of new Set(targets.map(item => item.definedType))) refetch_data(definedType);
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

	return <BGPDefinedSetTable data={set_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} error={isError} />;
}
