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
export default function Page503() {
	const navigate = useNavigate();

	const code = sessionStorage.getItem('error_code');
	const message = sessionStorage.getItem('error_message');

	if (code) {
		sessionStorage.removeItem('error_code');
		sessionStorage.removeItem('error_message');
	}

	return (
		<Box width="100%" height="100%" alignItems="center" justifyContent="center" display="flex" flexDirection="column">
			<Stack width="100%" maxWidth="400px" alignItems="center" spacing={2}>
				<Box component="img" src={Image503} alt="500" width="100%" maxWidth="250px" />

				<Typography variant="h6">{t("LoxiLB's Service is not enabled")}</Typography>

				<Typography variant="body2" whiteSpace="pre-wrap" textAlign="center" width="100%">
					{t('This can happen when the LoxiLB\'s Service is not available. Please enable service first and try again.')}
				</Typography>

				{message && (
					<Typography variant="body2" color="error" textAlign="center" width="100%" sx={{userSelect: 'text'}}>
						{t('Error Message')}: {message}
					</Typography>
				)}

				<Button variant="contained" onClick={() => navigate('/', {replace: true})}>
					{t('Go Home')}
				</Button>
			</Stack>
		</Box>
	);
}
