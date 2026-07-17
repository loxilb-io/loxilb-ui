//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Container, Paper, Typography, Tabs, Tab} from '@mui/material';
import {styled} from '@mui/material/styles';
import Logo from 'assets/logo/stamp.svg';
import {is_logged_in, move_forced, save_local_storage} from 'common';
import Particles from 'components/animation/Particles';
import BackBoard from 'components/element/BackBoard';
import AuthForm from 'components/input/AuthForm';
import {login_user, signup_and_login} from 'connector/user';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import {AuthMode, ICreateUserRequest, ILoginRequest} from 'types/user';
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
	const version = package_info.version;

	// Handle form submission (login or signup)
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

	// Handle tab change
	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setAuthMode(newValue === 0 ? 'login' : 'signup');
		setError(''); // Clear errors when switching modes
	};

	useEffect(() => {
		// Check if user is already logged in
		if (is_logged_in()) {
			move_forced('/instance');
		}
	}, []);

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
							{/* <Tab label={t('Sign Up')} /> */}
						</Tabs>
					</Box>

					{/* Auth Form */}
					<AuthForm
						mode={authMode}
						onSubmit={handleFormSubmit}
						loading={loading}
						error={error}
					/>
				</StyledPaper>
			</Container>
		</Box>
	);
}
