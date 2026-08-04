//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, AlertTitle, Box, Button, Container, Paper, Typography} from '@mui/material';
import {styled} from '@mui/material/styles';
import Logo from 'assets/logo/stamp.svg';
import {is_logged_in, move_forced, save_local_storage} from 'common';
import Particles from 'components/animation/Particles';
import BackBoard from 'components/element/BackBoard';
import AuthForm from 'components/input/AuthForm';
import {preflight_oam} from 'connector/oam/oam';
import {login_user} from 'connector/user';
import {t} from 'i18next';
import {useCallback, useEffect, useState} from 'react';
import {ILoginRequest} from 'types/user';
import package_info from '../../package.json';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
const StyledPaper = styled(Paper)(({theme}) => ({
	padding: theme.spacing(4),
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	marginTop: theme.spacing(8),
}));


export default function LoginPage() {
	const [error, setError] = useState<string>('');
	const [loading, setLoading] = useState(false);
	// Preflight: is the loxilb-oam backend reachable at all? The UI is only a
	// front-end for OAM, so a missing backend is the single most common
	// misdeployment. Surfacing it here turns an opaque "Login failed" into a
	// clear, actionable message. Starts optimistic ('checking') so a healthy
	// deployment shows no flash of warning.
	const [oamStatus, setOamStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking');
	const version = package_info.version;

	const runPreflight = useCallback(async () => {
		setOamStatus('checking');
		const status = await preflight_oam();
		setOamStatus(status);
	}, []);

	// This is a closed system: accounts are provisioned by an administrator
	// (see docs/SECURITY_RBAC_PLAN.md), so there is no self-service signup —
	// only login. Additional users are created from the User Management page.
	const handleFormSubmit = async (data: ILoginRequest) => {
		setLoading(true);
		setError('');

		try {
			const result = await login_user(data);
			save_local_storage('access_token', result.token);
			move_forced('/instance');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// Check if user is already logged in
		if (is_logged_in()) {
			move_forced('/instance');
			return;
		}
		runPreflight();
	}, [runPreflight]);

	return is_logged_in() ? null : (
		<Box width="100%" height="100%" display="flex" justifyContent="center" alignItems="center">
			<BackBoard bgcolor="black">
				<Particles
					particleColors={['#dd932c']}
					particleCount={400}
					particleSpread={10}
					speed={0.1}
					particleBaseSize={150}
					moveParticlesOnHover={false}
					alphaParticles={false}
					disableRotation={false}
				/>
			</BackBoard>

			<Container component="main" maxWidth="xs">
				<StyledPaper elevation={24}>
					<Box component="img" src={Logo} alt="LoxiLB Logo" width="100px" height="100px" />

					<Typography variant="subtitle2" color="textSecondary" marginTop="8px">
						{`v.${version}`}
					</Typography>

					{/* Preflight banner: the OAM backend is unreachable, so login
					    cannot succeed. Surface it plainly and offer a retry. */}
					{oamStatus === 'unreachable' && (
						<Alert
							severity="warning"
							sx={{mt: 2, width: '100%'}}
							action={
								<Button color="inherit" size="small" onClick={runPreflight}>
									{t('Retry')}
								</Button>
							}
						>
							<AlertTitle>{t("Can't reach the loxilb-oam management API")}</AlertTitle>
							{t('This UI is a front-end for loxilb-oam and needs a running backend to sign in. Check that loxilb-oam is up and that BACKEND_URL points to it — see the deployment guide.')}
						</Alert>
					)}

					{/* Auth Form (login only — admin-provisioned accounts) */}
					<AuthForm
						mode="login"
						onSubmit={handleFormSubmit}
						loading={loading}
						error={error}
						disabled={oamStatus === 'unreachable'}
					/>
				</StyledPaper>
			</Container>
		</Box>
	);
}
