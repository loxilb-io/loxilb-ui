//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import ChipField from 'components/element/ChipField';
import BGPPrefixTable from 'components/table/networks/BGPPrefixTable';
import {t} from 'i18next';
import {useState} from 'react';
import {IDefinedSetAttribute} from 'types/bgp_defined_set';
import TabView from './TabView';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinedSetView(props: {data: IDefinedSetAttribute}) {
	const {data} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);
	const tabs = [t('Prefix List'), t('Actions')];
	const title = t('{{name}} Details', {name: data.name});

	return (
		<TabView title={title} tabs={tabs} onChangeTab={set_cur_tab_idx}>
			<Box id="tab-pannel" marginTop="20px">
				{cur_tab_idx === 0 && <BGPPrefixTable data={data.prefixList} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />}
				{cur_tab_idx === 1 && <ChipField label={t('Values')} item_list={data.list} />}
			</Box>
		</TabView>
	);
}
