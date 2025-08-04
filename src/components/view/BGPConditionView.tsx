//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import ChipField from 'components/element/ChipField';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import AFITable from 'components/table/networks/AFITable';
import {t} from 'i18next';
import {useState} from 'react';
import {IAsPathSet, IBgpConditions, IConditionSet, IMatchNeighborSet, IMatchPrefixSet, IMatchSet} from 'types/bgp_policy_condition';
import TabView from './TabView';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function MatchSet(props: {title: string; option: string; set: string}) {
	const {title, option, set} = props;

	return (
		<ValueBunch name={title}>
			<SingleTextBox label={t('Option')} value={option} />
			<SingleTextBox label={t('Set')} value={set} />
		</ValueBunch>
	);
}

function MatchSetPannel(props: {conditions: IBgpConditions}) {
	const {conditions} = props;

	const aspathset: IAsPathSet = conditions.matchAsPathSet;
	const communityset: IMatchSet = conditions.matchCommunitySet;
	const extcommunityset: IMatchSet = conditions.matchExtCommunitySet;
	const largecommunityset: IMatchSet = conditions.matchLargeCommunitySet;

	return (
		<Stack spacing={3}>
			<MatchSet title={t('Autonomous System Path Set')} option={aspathset.matchSetOptions} set={aspathset.asPathSet} />
			<MatchSet title={t('Community Set')} option={communityset.matchSetOptions} set={communityset.communitySet} />
			<MatchSet title={t('Extended Community Set')} option={extcommunityset.matchSetOptions} set={extcommunityset.communitySet} />
			<MatchSet title={t('Large Community Set')} option={largecommunityset.matchSetOptions} set={largecommunityset.communitySet} />
		</Stack>
	);
}

function MatchNeighborSetPannel(props: {neightbor_set: IMatchNeighborSet; prefix_set: IMatchPrefixSet}) {
	const {neightbor_set, prefix_set} = props;

	return (
		<Stack spacing={3}>
			<MatchSet title={t('Match Neighbor Set')} option={neightbor_set.matchSetOption} set={neightbor_set.neighborSet} />
			<MatchSet title={t('Match Prefix Set')} option={prefix_set.matchSetOption} set={prefix_set.prefixSet} />
		</Stack>
	);
}

function AFIPanel(props: {afisafiIn: string[]}) {
	const {afisafiIn} = props;
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	return <AFITable data={afisafiIn} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />;
}

function NextHopInListPanel(props: {nextHopInList: string[]}) {
	const {nextHopInList} = props;
	return <ChipField label={t('IPs')} item_list={nextHopInList} />;
}

export default function BGPConditionView(props: {name: string; conditions?: IConditionSet}) {
	const {name, conditions} = props;

	const [cur_tab_idx, set_cur_tab_idx] = useState(0);
	const tabs = [t('Next Hop List'), t('AFI / SAFI'), t('Match Sets'), t('Match Neighbor / Prefix Set')];

	return conditions ? (
		<TabView title={name} sub_title={t('Condition Details')} tabs={tabs} onChangeTab={set_cur_tab_idx}>
			<Box id="tab-pannel" marginTop="20px">
				{cur_tab_idx === 0 && <NextHopInListPanel nextHopInList={conditions.bgpConditions.nextHopInList} />}
				{cur_tab_idx === 1 && <AFIPanel afisafiIn={conditions.bgpConditions.afiSafiIn} />}
				{cur_tab_idx === 2 && <MatchSetPannel conditions={conditions.bgpConditions} />}
				{cur_tab_idx === 3 && <MatchNeighborSetPannel neightbor_set={conditions.matchNeighborSet} prefix_set={conditions.matchPrefixSet} />}
			</Box>
		</TabView>
	) : null;
}
