//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Container, Paper, Typography} from '@mui/material';
import {styled} from '@mui/material/styles';
import Logo from 'assets/logo/stamp.svg';
import {is_logged_in, move_forced, save_local_storage} from 'common';
import Particles from 'components/animation/Particles';
import BackBoard from 'components/element/BackBoard';
import AuthForm from 'components/input/AuthForm';
import {login_user} from 'connector/user';
import {useEffect, useState} from 'react';
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
	const version = package_info.version;

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

					{/* Auth Form (login only — admin-provisioned accounts) */}
					<AuthForm
						mode="login"
						onSubmit={handleFormSubmit}
						loading={loading}
						error={error}
					/>
				</StyledPaper>
			</Container>
		</Box>
	);
}
