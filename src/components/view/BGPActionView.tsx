//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, TextField} from '@mui/material';
import ChipField from 'components/element/ChipField';
import ValueBunch from 'components/element/ValueBunch';
import {t} from 'i18next';
import {useState} from 'react';
import {IActionSet, IBgpSetCommunity} from 'types/bgp_policy_action';
import TabView from './TabView';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function CommunityPannel(props: {community: IBgpSetCommunity}) {
	const {community} = props;

	return (
		<ValueBunch>
			<TextField label={t('Option')} value={community.options} sx={{input: {textTransform: 'capitalize'}}} />
			<ChipField label={t('Methods')} item_list={community.setCommunityMethod} />
		</ValueBunch>
	);
}

export default function BGPActionView(props: {name: string; actions: IActionSet}) {
	const {name, actions} = props;

	const [cur_tab_idx, set_cur_tab_idx] = useState(0);
	const tabs = [t('Community'), t('Extended Community'), t('Large Commuity')];

	return (
		<TabView title={name} sub_title={t('Action Details')} tabs={tabs} onChangeTab={set_cur_tab_idx}>
			<Box id="tab-pannel" marginTop="20px">
				{cur_tab_idx === 0 && <CommunityPannel community={actions.bgpActions.setCommunity} />}
				{cur_tab_idx === 1 && <CommunityPannel community={actions.bgpActions.setExtCommunity} />}
				{cur_tab_idx === 2 && <CommunityPannel community={actions.bgpActions.setLargeCommunity} />}
			</Box>
		</TabView>
	);
}
