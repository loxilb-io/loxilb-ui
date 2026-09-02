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
import {beginSession, consumeRedirectTarget, consumeSessionEndReason, parseJwtExp, SessionEndReason} from 'session/session';
import {t} from 'i18next';
import {useCallback, useEffect, useState} from 'react';
import {ILoginRequest} from 'types/user';
import {APP_VERSION} from 'version';

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
	// Why the previous session ended, if it ended on its own. Read ONCE (the
	// reason is consumed as it is read) so a later reload cannot re-accuse the
	// operator of having gone idle. reports this here rather than in a
	// dialog on the page being navigated away from.
	const [endedReason] = useState<SessionEndReason | null>(() => consumeSessionEndReason());
	const [loading, setLoading] = useState(false);
	// Preflight: is the loxilb-oam backend reachable at all? The UI is only a
	// front-end for OAM, so a missing backend is the single most common
	// misdeployment. Surfacing it here turns an opaque "Login failed" into a
	// clear, actionable message. Starts optimistic ('checking') so a healthy
	// deployment shows no flash of warning.
	const [oamStatus, setOamStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking');

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
			// login_user resolves to an OpResult — mapped machine code plus a
			// locale key. Raw backend prose never reaches this screen:
			// this page is the first thing every operator sees, and the
			// lockout message must stay distinct from a typo'd password while
			// not disclosing the lockout policy (the conservative default).
			const result = await login_user(data);
			if (result.status === 'confirmed' && result.data?.token) {
				// A token whose lifetime cannot be established must not be
				// installed: without a readable `exp` the UI has no
				// basis for a proactive logout and the session would run
				// unbounded until some request happened to bounce 401.
				try {
					parseJwtExp(result.data.token);
				} catch {
					setError(t('The server returned a token this client cannot read. Please try again or contact your administrator.'));
					return;
				}
				beginSession();
				save_local_storage('access_token', result.data.token);
				// Return the operator to where the session ended, not to the
				// landing page. The stored value is a validated local
				// route; anything else was refused at storage time.
				move_forced(consumeRedirectTarget() ?? '/instance');
			} else {
				setError(t(result.localeKey));
			}
		} catch {
			setError(t('Login failed'));
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
						{`v.${APP_VERSION}`}
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

					{/* Why the last session ended — an explanation, not an error:
					    the operator did nothing wrong and the next login is
					    expected to succeed. 'revoked' is deliberately worded
					    without disclosing WHY the server rejected the token. */}
					{endedReason && endedReason !== 'logout' && (
						<Alert severity="info" sx={{mt: 2, width: '100%'}}>
							{endedReason === 'expired' && t('Your session expired. Please sign in again.')}
							{endedReason === 'idle' && t('You were signed out after a period of inactivity. Please sign in again.')}
							{endedReason === 'revoked' && t('Your session ended. Please sign in again.')}
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
