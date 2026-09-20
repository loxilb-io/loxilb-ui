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
			{/* A section title, so it stays a heading: `subtitle2` is a SIZE and no
			    longer implies one (see theme.ts). h2 sits under the layout h1. */}
			{name && <Typography variant="subtitle2" component="h2">{name}</Typography>}

			<Box display="flex" gap="20px">
				{children}
			</Box>
		</Stack>
	);
}
