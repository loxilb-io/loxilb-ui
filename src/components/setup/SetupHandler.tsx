//---------------------------------------------------------
// Setup Detection and Routing Handler
//---------------------------------------------------------
import {useEffect, useState} from 'react';
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
					console.log('Setup required, redirecting to /setup');
					navigate('/setup', {replace: true});
				}

				setSetupChecked(true);
			} catch (error) {
				console.warn('Setup check failed, continuing with normal flow:', error);
				setSetupChecked(true);
			}
		};

		checkSetup();
	}, [navigate, location.pathname]);

	// Show loading or nothing while checking setup
	if (!setupChecked) {
		return null; // or <LoadingSpinner /> if you have one
	}

	return <>{children}</>;
}