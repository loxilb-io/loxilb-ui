//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LowerSection(props: {children: ReactNode}) {
	const {children} = props;

	return (
		<Box id="lower-area" width="100%" flexGrow={1} display="flex" flexDirection="column" paddingTop="10px" paddingBottom="20px" marginTop="20px" borderTop="1px solid #e0e0e0">
			{children}
		</Box>
	);
}
