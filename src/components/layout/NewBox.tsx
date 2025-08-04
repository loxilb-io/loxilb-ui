//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import {t} from 'i18next';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function NewBox(props: {item_name: string; children?: ReactNode}) {
	const {item_name, children} = props;

	return (
		<Box display="flex" flexDirection="column" gap={4}>
			<Typography variant="h6" color="text.secondary">
				{t('New {{item_name}}', {item_name})}
			</Typography>

			<Stack spacing={2} width="100%">
				{children}
			</Stack>
		</Box>
	);
}
