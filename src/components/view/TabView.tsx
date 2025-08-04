//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SubTabs from 'components/element/SubTabs';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TabView(props: {title: string; sub_title?: string; tabs: string[]; onChangeTab: any; children?: ReactNode}) {
	const {title, sub_title, tabs, onChangeTab, children} = props;

	return (
		<SubTitlePannel title={title} sub_title={sub_title}>
			<Stack>
				<SubTabs tabs={tabs} onChange={onChangeTab} />
				{children}
			</Stack>
		</SubTitlePannel>
	);
}
