//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ValueBunch(props: {name?: string; children?: ReactNode}) {
	const {name, children} = props;

	return (
		<Stack spacing={1}>
			{name && <Typography variant="subtitle2">{name}</Typography>}

			<Box display="flex" gap="20px">
				{children}
			</Box>
		</Stack>
	);
}
