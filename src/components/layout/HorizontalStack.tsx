//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HorizontalStack(props: {align?: 'flex-start' | 'center' | 'space-between'; children?: ReactNode}) {
	const {align, children} = props;

	return (
		<Stack direction="row" width="100%" justifyContent={align ?? 'space-between'} spacing={2}>
			{children}
		</Stack>
	);
}
