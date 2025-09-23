//---------------------------------------------------------
// Admin Credential Update Setup Page
//---------------------------------------------------------
import {Alert, Box, Button, Container, Paper, TextField, Typography} from '@mui/material';
import {styled} from '@mui/material/styles';
import Logo from 'assets/logo/stamp.svg';
import {move_forced} from 'common';
import {request_update_admin_credentials} from 'connector/oam/oam';
import {usePopUp} from 'hooks/popupHook';
import {t} from 'i18next';
import {useState} from 'react';
import {IUpdateAdminRequest} from 'types/setup';

//---------------------------------------------------------
// Styled Components
//---------------------------------------------------------
const StyledPaper = styled(Paper)(({theme}) => ({
	padding: theme.spacing(4),
	display: 'flex',
	flexDirection: 'column',
	alignItems: 'center',
	marginTop: theme.spacing(8),
	maxWidth: 400,
	width: '100%',
}));

const FormContainer = styled(Box)(({theme}) => ({
	width: '100%',
	marginTop: theme.spacing(2),
}));

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function SimpleSetupPage() {
	const [formData, setFormData] = useState<IUpdateAdminRequest>({
		currentUsername: 'admin',
		currentPassword: '',
		newUsername: '',
		newPassword: '',
		newEmail: '',
		confirmPassword: '',
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const {openPopUp} = usePopUp();

	const handleChange = (field: keyof IUpdateAdminRequest) => (event: React.ChangeEvent<HTMLInputElement>) => {
		setFormData(prev => ({...prev, [field]: event.target.value}));
		if (error) setError(''); // Clear error when user types
	};

	const validateForm = (): string | null => {
		if (!formData.currentPassword || !formData.newUsername || !formData.newPassword || !formData.newEmail || !formData.confirmPassword) {
			return 'All fields are required';
		}
		if (formData.newPassword !== formData.confirmPassword) {
			return 'Passwords do not match';
		}
		if (formData.newPassword.length < 9) {
			return 'Password must be at least 9 characters long';
		}
		if (formData.currentPassword === formData.newPassword) {
			return 'New password must be different from current password';
		}
		return null;
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		
		// Validation
		const validationError = validateForm();
		if (validationError) {
			setError(validationError);
			return;
		}

		setLoading(true);
		setError('');

		try {
			// Update admin credentials
			const result = await request_update_admin_credentials(formData);
			
			if (!result.success) {
				throw new Error(result.message);
			}

			// Success - show message and redirect to login
			openPopUp(
				t('Credentials Updated!'),
				t('Your admin credentials have been updated successfully. Please log in with your new credentials.'),
				t('Continue to Login'),
				'',
				() => move_forced('/login')
			);

		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update credentials');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Container component="main" maxWidth="xs">
			<StyledPaper elevation={24}>
				<Box component="img" src={Logo} alt="LoxiLB Logo" width="80px" height="80px" />
				
				<Typography variant="h5" component="h1" marginTop={2}>
					{t('Update Admin Credentials')}
				</Typography>
				
				<Typography variant="body2" color="textSecondary" marginTop={1} textAlign="center">
					{t('Update your admin credentials from the default password')}
				</Typography>

				{error && (
					<Alert severity="error" sx={{width: '100%', mt: 2}}>
						{error}
					</Alert>
				)}

				<Box component="form" onSubmit={handleSubmit} sx={{width: '100%', mt: 2}}>
					<TextField
						margin="normal"
						required
						fullWidth
						label={t('Current Username')}
						value={formData.currentUsername}
						onChange={handleChange('currentUsername')}
						disabled={true}
						helperText={t('Default admin username')}
					/>
					
					<TextField
						margin="normal"
						required
						fullWidth
						label={t('Current Password')}
						type="password"
						value={formData.currentPassword}
						onChange={handleChange('currentPassword')}
						disabled={loading}
						helperText={t('Enter the default admin password')}
						autoFocus
					/>
					
					<TextField
						margin="normal"
						required
						fullWidth
						label={t('New Username')}
						value={formData.newUsername}
						onChange={handleChange('newUsername')}
						disabled={loading}
					/>
					
					<TextField
						margin="normal"
						required
						fullWidth
						label={t('New Password')}
						type="password"
						value={formData.newPassword}
						onChange={handleChange('newPassword')}
						disabled={loading}
						helperText={t('Minimum 9 characters')}
					/>
					
					<TextField
						margin="normal"
						required
						fullWidth
						label={t('Confirm New Password')}
						type="password"
						value={formData.confirmPassword}
						onChange={handleChange('confirmPassword')}
						disabled={loading}
					/>
					
					<TextField
						margin="normal"
						required
						fullWidth
						label={t('New Email')}
						type="email"
						value={formData.newEmail}
						onChange={handleChange('newEmail')}
						disabled={loading}
					/>

					<Button
						type="submit"
						fullWidth
						variant="contained"
						disabled={loading}
						sx={{mt: 3, mb: 2}}
					>
						{loading ? t('Updating...') : t('Update Credentials')}
					</Button>
				</Box>
			</StyledPaper>
		</Container>
	);
}