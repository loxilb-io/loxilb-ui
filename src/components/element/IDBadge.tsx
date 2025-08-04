//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IDBadge(props: {id: number | string}) {
	const {id} = props;

	return (
		<Box display="flex" alignItems="center" gap="8px">
			<Box padding={'2px 10px'} bgcolor="secondary.main" color="secondary.contrastText" borderRadius="4px">
				<Typography variant="caption">{t('ID')}</Typography>
			</Box>

			<Typography variant="body2">{id}</Typography>
		</Box>
	);
}
