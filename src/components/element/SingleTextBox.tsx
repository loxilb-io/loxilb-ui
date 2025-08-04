//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, capitalize, Stack, Typography} from '@mui/material';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SingleTextBox(props: {label: string; value?: string | number | boolean}) {
	const {label, value} = props;

	const min_width = '220px';

	return (
		<Box width={min_width}>
			<Stack width="100%">
				<Typography variant="caption" color="text.secondary" sx={{userSelect: 'text'}}>
					{label}
				</Typography>
				<Typography variant="body2" sx={{userSelect: 'text'}}>
					{value === false ? 'false' : value !== null && value !== undefined ? capitalize(value.toString()) : t('None')}
				</Typography>
			</Stack>
		</Box>
	);
}
