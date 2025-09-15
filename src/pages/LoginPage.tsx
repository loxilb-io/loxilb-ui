//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Box, Container, Paper, Typography, Tabs, Tab, Divider} from '@mui/material';
import {styled} from '@mui/material/styles';
import Logo from 'assets/logo/CI_KETI.png';
import {is_logged_in, move_forced, save_local_storage} from 'common';
import Particles from 'components/animation/Particles';
import BackBoard from 'components/element/BackBoard';
import AuthForm from 'components/input/AuthForm';
import OAuthButton from 'components/input/OAuthButton';
import {login_user, signup_and_login} from 'connector/user';
import {oauth_initiate_login, is_oauth_callback, get_oauth_callback_params, oauth_handle_callback, get_oauth_provider_from_state} from 'connector/oauth';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import {AuthMode, ICreateUserRequest, ILoginRequest, IOAuthLoadingState, OAuthProvider} from 'types/user';
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
	const [authMode, setAuthMode] = useState<AuthMode>('login');
	const [error, setError] = useState<string>('');
	const [loading, setLoading] = useState(false);
	const [oauthLoading, setOauthLoading] = useState<IOAuthLoadingState>({
		google: false,
		github: false,
	});
	const version = package_info.version;

	// Handle traditional form submission (login or signup)
	const handleFormSubmit = async (data: ILoginRequest | ICreateUserRequest) => {
		setLoading(true);
		setError('');

		try {
			let result;
			
			if (authMode === 'login') {
				result = await login_user(data as ILoginRequest);
			} else {
				result = await signup_and_login(data as ICreateUserRequest);
			}

			save_local_storage('access_token', result.token);
			move_forced('/instance');
		} catch (err) {
			setError(err instanceof Error ? err.message : `${authMode === 'login' ? 'Login' : 'Signup'} failed`);
		} finally {
			setLoading(false);
		}
	};

	// Handle OAuth button clicks
	const handleOAuthLogin = async (provider: OAuthProvider) => {
		setOauthLoading(prev => ({ ...prev, [provider]: true }));
		setError('');

		try {
			await oauth_initiate_login(provider);
			// The function will redirect to OAuth provider, so execution stops here
		} catch (err) {
			setError(err instanceof Error ? err.message : `${provider} login failed`);
			setOauthLoading(prev => ({ ...prev, [provider]: false }));
		}
	};

	// Handle tab change
	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setAuthMode(newValue === 0 ? 'login' : 'signup');
		setError(''); // Clear errors when switching modes
	};

	// Handle OAuth callback on component mount
	useEffect(() => {
		// Check if user is already logged in
		if (is_logged_in()) {
			move_forced('/instance');
			return;
		}

		// Temporarily disable OAuth callback detection to test normal login
		// TODO: Re-enable after fixing OAuth flow
		/*
		// Check if this is an OAuth callback
		if (is_oauth_callback()) {
			const callbackParams = get_oauth_callback_params();
			if (callbackParams) {
				const provider = get_oauth_provider_from_state(callbackParams.state);
				if (provider) {
					handleOAuthCallback(provider, callbackParams);
				}
			}
		}
		*/
	}, []);

	// Handle OAuth callback
	const handleOAuthCallback = async (provider: OAuthProvider, params: any) => {
		setLoading(true);
		setError('');

		try {
			const result = await oauth_handle_callback(provider, params);
			save_local_storage('access_token', result.token);
			
			// Clean up URL
			window.history.replaceState({}, document.title, window.location.pathname);
			
			move_forced('/instance');
		} catch (err) {
			setError(err instanceof Error ? err.message : `${provider} authentication failed`);
			// Clean up URL on error too
			window.history.replaceState({}, document.title, window.location.pathname);
		} finally {
			setLoading(false);
		}
	};

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
					<Box component="img" src={Logo} alt="KETI Logo" sx={{ width: "200px", height: "auto", maxWidth: "100%" }} />

					<Typography variant="subtitle2" color="textSecondary" marginTop="8px">
						{`v.${version}`}
					</Typography>

					{/* Auth Mode Tabs */}
					<Box sx={{ width: '100%', mt: 2 }}>
						<Tabs
							value={authMode === 'login' ? 0 : 1}
							onChange={handleTabChange}
							variant="fullWidth"
							sx={{
								minHeight: '40px',
								'& .MuiTab-root': {
									minHeight: '40px',
									fontSize: '14px',
									textTransform: 'none',
								},
							}}
						>
							<Tab label={t('Login')} />
							<Tab label={t('Sign Up')} />
						</Tabs>
					</Box>

					{/* Auth Form */}
					<AuthForm
						mode={authMode}
						onSubmit={handleFormSubmit}
						loading={loading}
						error={error}
					/>

					{/* <Box sx={{ width: '280px', my: 2 }}>
						<Divider>
							<Typography variant="body2" color="textSecondary">
								{t('OR')}
							</Typography>
						</Divider>
					</Box>

					<Box sx={{ width: '280px' }}>
						<OAuthButton
							provider="google"
							loading={oauthLoading.google}
							disabled={loading || oauthLoading.github}
							onClick={handleOAuthLogin}
						/>
						<OAuthButton
							provider="github"
							loading={oauthLoading.github}
							disabled={loading || oauthLoading.google}
							onClick={handleOAuthLogin}
						/>
					</Box> */}
				</StyledPaper>
			</Container>
		</Box>
	);
}
