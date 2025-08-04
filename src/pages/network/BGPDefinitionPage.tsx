//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import SubTabs from 'components/element/SubTabs';
import BGPPolicyInputForm from 'components/input/BGPPolicyInputForm';
import DropDownMenu from 'components/menu/DropDownMenu';
import BGPActionTable from 'components/table/networks/BGPActionTable';
import BGPConditionTable from 'components/table/networks/BGPConditionTable';
import {request_create_bgp_policy_definition, request_delete_bgp_policy_definition} from 'connector/instance/bgp';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBGPPolicyDefs} from 'hooks/query/bgpHooks';
import {t} from 'i18next';
import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {IBgpPolicy, IBgpPolicyInfo} from 'types/bgp_policy';
import {IActionSet} from 'types/bgp_policy_action';
import {IConditionSet} from 'types/bgp_policy_condition';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinitionPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useBGPPolicyDefs(inst); // IBgpPolicy[]
	const def_info: IBgpPolicyInfo = {bgpPolicyAttr: data ?? []};

	const [cur_tab_idx, set_cur_tab_idx] = useState(0);
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const has_policies = def_info.bgpPolicyAttr.length > 0;
	const [cur_policy, set_cur_policy] = useState<IBgpPolicy | undefined>(has_policies ? def_info.bgpPolicyAttr[0] : undefined);

	const tabs = [t('Conditions'), t('Actions')];
	const policy_list: string[] = def_info.bgpPolicyAttr.map(policy => policy.name);

	useEffect(() => {
		set_selected_rows([]);
	}, [cur_tab_idx, cur_policy]);

	const condition_list: IConditionSet[] = useMemo(() => {
		return cur_policy?.statements.map(item => item.conditions) ?? [];
	}, [cur_policy]);

	const action_list: IActionSet[] = useMemo(() => {
		return cur_policy?.statements.map(item => item.actions) ?? [];
	}, [cur_policy]);

	const handleDelete = async () => {
		if (!inst) return;

		const item = def_info.bgpPolicyAttr[selected_rows[0]];
		const res = await request_delete_bgp_policy_definition(inst, item.name);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IBgpPolicy | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<BGPPolicyInputForm
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

				const res = await request_create_bgp_policy_definition(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return (
		<Fragment>
			<Box id="head-nav" display="flex" gap="20px" marginBottom="10px" alignItems="flex-end">
				<DropDownMenu label={t('Policy Name')} item_list={policy_list} onMenuChange={(index: number) => set_cur_policy(def_info.bgpPolicyAttr[index])} />

				<SubTabs
					tabs={tabs}
					onChange={(index: number) => {
						set_cur_tab_idx(index);
						set_selected_rows([]);
					}}
				/>
			</Box>

			{cur_tab_idx === 0 && (
				<BGPConditionTable
					condition_list={condition_list}
					selected_rows={selected_rows}
					onChangeSelectedRows={set_selected_rows}
					onAdd={handleAdd}
					onDelete={handleDelete}
				/>
			)}
			{cur_tab_idx === 1 && (
				<BGPActionTable action_list={action_list} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} />
			)}
		</Fragment>
	);
}
