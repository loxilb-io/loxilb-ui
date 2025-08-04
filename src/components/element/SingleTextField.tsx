//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, TextField, Tooltip} from '@mui/material';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SingleTextField(props: {label: string; value?: string; tooltip?: string}) {
	const {label, value} = props;

	const min_width = '220px';

	return (
		<Tooltip title={t(props.tooltip || '')} placement="top" arrow>
			<Box width={min_width}>
				<TextField label={label} value={value || 'None'} variant="outlined" fullWidth />
			</Box>
		</Tooltip>
	);
}
