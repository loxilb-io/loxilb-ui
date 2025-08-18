//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, capitalize, Stack, Typography} from '@mui/material';
import {t} from 'i18next';
import TooltipMark from './TooltipMark';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SingleTextBox(props: {label: string; value?: string | number | boolean; tooltip?: string}) {
	const {label, value, tooltip} = props;

	const min_width = '220px';

	return (
		<Box width={min_width}>
			<Stack width="100%">
				<Box display="flex" alignItems="center" gap="5px">
					<Typography variant="caption" color="text.secondary" sx={{userSelect: 'text'}}>
						{label}
					</Typography>
					{tooltip && <TooltipMark content={tooltip} />}
				</Box>
				<Typography variant="body2" sx={{userSelect: 'text'}}>
					{value === false ? 'False' : value !== null && value !== undefined ? capitalize(value.toString()) : t('None')}
				</Typography>
			</Stack>
		</Box>
	);
}
