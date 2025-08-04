//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BackBoard(props: {children: ReactNode; bgcolor?: string; bgcolor2?: string}) {
	const {children, bgcolor, bgcolor2} = props;

	const color_str = bgcolor && bgcolor2 ? `linear-gradient(to bottom, ${bgcolor}, ${bgcolor2})` : bgcolor || 'transparent';

	return (
		<Box zIndex={-1} position="fixed" top={0} left={0} width="100vw" height="100vh" sx={{background: color_str}} display="flex" alignItems="center">
			{children}
		</Box>
	);
}
