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
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinedSetPage() {
	const inst = useInstanceFromURL();

	const prefix_query = useBGPDefinedSets(inst, 'prefix'); // prefixList is avalable
	const neighbor_query = useBGPDefinedSets(inst, 'neighbor'); // list is avalable
	const aspath_query = useBGPDefinedSets(inst, 'aspath'); // list is avalable
	const community_query = useBGPDefinedSets(inst, 'community'); // list is avalable
	const extcommunity_query = useBGPDefinedSets(inst, 'extcommunity'); // list is avalable
	const largecommunity_query = useBGPDefinedSets(inst, 'largecommunity'); // list is avalable

	const {data: prefix_data, refetch: refetch_prefix} = prefix_query;
	const {data: neighbor_data, refetch: refetch_neighbor} = neighbor_query;
	const {data: aspath_data, refetch: refetch_aspath} = aspath_query;
	const {data: community_data, refetch: refetch_comm} = community_query;
	const {data: extcommunity_data, refetch: refetch_extcomm} = extcommunity_query;
	const {data: largecommunity_data, refetch: refetch_largecomm} = largecommunity_query;

	const defined_set_queries = [prefix_query, neighbor_query, aspath_query, community_query, extcommunity_query, largecommunity_query];

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

	// One table, six reads. If any of them failed while the others answered,
	// the rows on screen are a PARTIAL list — which is not "empty" and not a
	// clean failure either, so the six collapse into one query-shaped value
	// and the shared mapper reaches `stale`: the rows stay readable, the page
	// says they may not match the server, and writes are held. Only when
	// nothing answered at all does it become a hard failure.
	const defined_set_state = toPageState(
		{
			data: defined_set_queries.some(q => q.data !== undefined) ? set_data.definedsetsAttr : undefined,
			error: defined_set_queries.find(q => q.error)?.error,
			// The OLDEST successful read, not the newest: the screen as a whole
			// is only as current as its stalest part.
			dataUpdatedAt: Math.min(...defined_set_queries.map(q => q.dataUpdatedAt).filter(t => t > 0), Date.now()),
		},
		{op: 'bgp_defined_set.list'},
	);

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
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: results.length}), t('OK'));
		} else if (failures.length < results.length) {
			openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)})}), t('OK'));
		} else {
			openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: t(failures[0].localeKey)}), t('OK'));
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
				if (res.status === 'confirmed') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch_data(instanceRef.current.definedType);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: t(res.localeKey)}), t('OK'));
			},
			true,
		);
	};

	return <BGPDefinedSetTable data={set_data} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} state={defined_set_state} />;
}
