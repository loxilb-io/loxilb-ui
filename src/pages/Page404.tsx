//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Stack, Typography} from '@mui/material';
import Image404 from 'assets/image/404.svg';
import {t} from 'i18next';
import {useNavigate} from 'react-router-dom';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function Page404() {
	const navigate = useNavigate();

	return (
		<Box width="100%" height="100%" alignItems="center" justifyContent="center" display="flex" flexDirection="column">
			<Stack width="400px" alignItems="center" spacing={2}>
				<Box component="img" src={Image404} alt="404" width="100%" maxWidth="250px" />

				<Typography variant="h6">{t('Page not found')}</Typography>

				<Typography variant="body2" whiteSpace="pre-wrap" textAlign="center" width="100%" maxWidth="400px">
					{t('Sorry, but the page you’re looking for doesn’t exist.')}
				</Typography>

				<Button variant="contained" onClick={() => navigate('/', {replace: true})}>
					{t('Go Home')}
				</Button>
			</Stack>
		</Box>
	);
}
