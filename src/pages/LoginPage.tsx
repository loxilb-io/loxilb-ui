//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import {Alert, Box, Button, Container, InputAdornment, Paper, TextField, Typography} from '@mui/material';
import {styled} from '@mui/material/styles';
import Logo from 'assets/logo/stamp.svg';
import {is_logged_in, move_forced, save_local_storage} from 'common';
import Particles from 'components/animation/Particles';
import BackBoard from 'components/element/BackBoard';
import {SimpleResponse} from 'connector/fetcher/fetcher_base';
import {POST_OAM} from 'connector/fetcher/fetcher_oam';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
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

const FormBox = styled('form')(({theme}) => ({
	width: '100%',
	marginTop: theme.spacing(1),
}));

export default function LoginPage() {
	const [username, set_username] = useState(process.env.REACT_APP_TEST_ID || '');
	const [password, setPassword] = useState(process.env.REACT_APP_TEST_PW || '');
	const [error, setError] = useState<string>('');
	const [loading, setLoading] = useState(false);
	const version = package_info.version;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError('');

		try {
			const resp: SimpleResponse = await POST_OAM('/login', {username: username, password});
			if (resp.code !== 200) throw new Error(`Login failed: ${resp.message}(${resp.code.toString()})`);

			save_local_storage('access_token', resp.data.token);
			move_forced('/instance');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		is_logged_in() && move_forced('/instance');
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

					{error && (
						<Alert severity="error" sx={{mt: 2, width: '100%'}}>
							{error}
						</Alert>
					)}

					<FormBox onSubmit={handleSubmit} sx={{width: '280px'}}>
						<TextField
							margin="normal"
							required
							fullWidth
							id="ID"
							label={t('ID')}
							name="id"
							autoFocus
							autoComplete="username"
							value={username}
							slotProps={{
								input: {
									startAdornment: (
										<InputAdornment position="start">
											<PersonIcon color="disabled" />
										</InputAdornment>
									),
								},
							}}
							onChange={e => set_username(e.target.value)}
						/>

						<TextField
							margin="normal"
							required
							fullWidth
							name="password"
							label={t('Password')}
							type="password"
							id="password"
							autoComplete="current-password"
							value={password}
							slotProps={{
								input: {
									startAdornment: (
										<InputAdornment position="start">
											<LockIcon color="disabled" />
										</InputAdornment>
									),
								},
							}}
							onChange={e => setPassword(e.target.value)}
						/>
						<Button type="submit" fullWidth variant="contained" sx={{mt: 3, mb: 2}} disabled={loading}>
							{loading ? t('Loading...') : t('Login')}
						</Button>
					</FormBox>
				</StyledPaper>
			</Container>
		</Box>
	);
}
