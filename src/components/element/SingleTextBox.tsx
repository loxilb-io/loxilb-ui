//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, capitalize, Stack, Typography} from '@mui/material';
import {t} from 'i18next';
import TooltipMark from './TooltipMark';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// 220px fits ordinary values; 'wide' (300px) fits a 36-char UUID or a 32-char
// machine ID on one line — measured at the body2 Inter size.
const WIDTHS = {normal: '220px', wide: '300px'};

export default function SingleTextBox(props: {label: string; value?: string | number | boolean; tooltip?: string; width?: keyof typeof WIDTHS}) {
	const {label, value, tooltip, width = 'normal'} = props;

	return (
		<Box width={WIDTHS[width]}>
			<Stack width="100%">
				<Box display="flex" alignItems="center" gap="5px">
					<Typography variant="caption" color="text.secondary" sx={{userSelect: 'text'}}>
						{label}
					</Typography>
					{tooltip && <TooltipMark content={tooltip} />}
				</Box>
				{/* Machine IDs, boot IDs and hashes are unbroken strings with no space
				    to wrap at, so they used to overflow the fixed 220px column and
				    render on top of the next field's value. */}
				<Typography variant="body2" sx={{userSelect: 'text', overflowWrap: 'anywhere'}}>
					{/* {value === false ? 'False' : value !== null && value !== undefined ? capitalize(value.toString()) : t('None')} */}
					{value === false ? 'False' : value !== null && value !== undefined ? value.toString() : t('None')}
				</Typography>
			</Stack>
		</Box>
	);
}
