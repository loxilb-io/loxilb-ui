//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Stack, Typography} from '@mui/material';
import Image503 from 'assets/image/overcapacity.svg';
import {t} from 'i18next';
import {useNavigate} from 'react-router-dom';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function PageCORS() {
	const navigate = useNavigate();

	return (
		<Box width="100%" height="100%" alignItems="center" justifyContent="center" display="flex" flexDirection="column">
			<Stack width="100%" maxWidth="400px" alignItems="center" spacing={2}>
				<Box component="img" src={Image503} alt="500" width="100%" maxWidth="250px" />

				<Typography variant="h6">{t('Blocked by CORS')}</Typography>

				<Typography variant="body2" whiteSpace="pre-wrap" textAlign="center" width="100%">
					{t("Response to preflight request doesn't pass access control check.")}
				</Typography>

				<Button variant="contained" onClick={() => navigate('/', {replace: true})}>
					{t('Go Home')}
				</Button>
			</Stack>
		</Box>
	);
}
