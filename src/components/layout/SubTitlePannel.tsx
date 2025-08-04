//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import SubTitleBar from 'components/element/SubTitleBar';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SubTitlePannel(props: {title: string; sub_title?: string; children?: ReactNode}) {
	const {title, sub_title, children} = props;

	return (
		<Box width="100%">
			<Stack gap="10px">
				<SubTitleBar title={title} sub_title={sub_title} />

				{children}
			</Stack>
		</Box>
	);
}
