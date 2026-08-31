//---------------------------------------------------------
// Setup Detection and Routing Handler
//---------------------------------------------------------
import {Box, CircularProgress} from '@mui/material';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation, useNavigate} from 'react-router-dom';
import {shouldRedirectToSetup} from 'utils/simpleSetup';

interface SetupHandlerProps {
	children: React.ReactNode;
}

/**
 * Component that handles setup detection and routing
 * Checks if setup is needed and redirects to /setup if required
 */
export default function SetupHandler({children}: SetupHandlerProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const {t} = useTranslation();
	const [setupChecked, setSetupChecked] = useState(false);

	useEffect(() => {
		const checkSetup = async () => {
			try {
				// Skip setup check if already on setup page or error pages
				const skipSetupCheck = ['/setup', '/404', '/500', '/cors'].includes(location.pathname);

				if (skipSetupCheck) {
					setSetupChecked(true);
					return;
				}

				// Check if setup is needed
				const needsSetup = await shouldRedirectToSetup();

				if (needsSetup) {
					navigate('/setup', {replace: true});
				}

				setSetupChecked(true);
			} catch (error) {
				// eslint-disable-next-line no-console -- deliberate operator-visible log on a failure/edge path; listed in the expected-console-message catalogue
				console.warn('Setup check failed, continuing with normal flow:', error);
				setSetupChecked(true);
			}
		};

		checkSetup();
	}, [navigate, location.pathname]);

	// While the check is in flight the app renders nothing. That window is
	// bounded by SETUP_CHECK_TIMEOUT_MS (utils/simpleSetup) — without that
	// bound a hung OAM left a permanently blank page here, with no login form
	// and no error. Show a spinner rather than a white screen so the state is
	// legible as "loading" instead of "broken".
	if (!setupChecked) {
		return (
			<Box display="flex" alignItems="center" justifyContent="center" height="100vh" width="100%">
				<CircularProgress aria-label={t('Loading...')} />
			</Box>
		);
	}

	return <>{children}</>;
}