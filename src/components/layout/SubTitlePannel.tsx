//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import SubTitleBar from 'components/element/SubTitleBar';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SubTitlePannel(props: {title: string; sub_title?: string; action?: ReactNode; children?: ReactNode}) {
	const {title, sub_title, action, children} = props;

	return (
		<Box width="100%">
			<Stack gap="10px">
				{action ? (
					// Header row with a right-aligned action (e.g. IPsec "Global Settings")
					// so the control anchors to the title instead of floating on its own band.
					<Box display="flex" justifyContent="space-between" alignItems="center" gap="10px">
						<SubTitleBar title={title} sub_title={sub_title} />
						{action}
					</Box>
				) : (
					<SubTitleBar title={title} sub_title={sub_title} />
				)}

				{children}
			</Stack>
		</Box>
	);
}
