//---------------------------------------------------------
// Admin Credential Update Setup Page
//---------------------------------------------------------
import {Alert, Box, Button, Container, Paper, TextField, Typography, Tooltip} from '@mui/material';
import {styled} from '@mui/material/styles';
import InfoIcon from '@mui/icons-material/Info';
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
	maxWidth: 400,
	width: '100%',
	maxHeight: '90vh',
	overflow: 'auto',
}));

// Remove unused FormContainer to fix diagnostic warning

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

		// Enhanced password validation matching AuthForm requirements
		const password = formData.newPassword;
		if (password.length < 9) {
			return 'Password must be at least 9 characters long';
		}
		if (!/[A-Z]/.test(password)) {
			return 'Password must contain at least one uppercase letter';
		}
		if (!/[a-z]/.test(password)) {
			return 'Password must contain at least one lowercase letter';
		}
		if (!/[0-9]/.test(password)) {
			return 'Password must contain at least one number';
		}
		if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
			return 'Password must contain at least one special character';
		}
		// Check for same character more than twice in a row
		if (/(.)\1{2,}/.test(password)) {
			return 'Password must not contain the same character more than twice in a row';
		}
		// Check for consecutive characters (simple check for abc, 123, etc.)
		for (let i = 0; i < password.length - 2; i++) {
			const charCode1 = password.charCodeAt(i);
			const charCode2 = password.charCodeAt(i + 1);
			const charCode3 = password.charCodeAt(i + 2);
			if (charCode2 === charCode1 + 1 && charCode3 === charCode2 + 1) {
				return 'Password must not contain consecutive characters';
			}
		}
		if (password.toLowerCase() === formData.newUsername.toLowerCase()) {
			return 'Password must not be the same as the username';
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
				t('Continue'),
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
		<Container
			component="main"
			maxWidth="xs"
			sx={{
				minHeight: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				py: 2,
				overflow: 'auto'
			}}
		>
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
						helperText={
							<Box display="flex" alignItems="center" gap={0.5}>
								{t('Minimum 9 characters with complexity requirements')}
								<Tooltip
									title={
										<Box sx={{ p: 1 }}>
											<Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
												{t('Password Requirements:')}
											</Typography>
											<Typography variant="body2" component="div">
												• {t('Must be at least 9 characters long')}<br/>
												• {t('Must contain at least one uppercase letter')}<br/>
												• {t('Must contain at least one lowercase letter')}<br/>
												• {t('Must contain at least one number')}<br/>
												• {t('Must contain at least one special character')}<br/>
												• {t('Must not contain the same character more than twice in a row')}<br/>
												• {t('Must not contain consecutive characters')}<br/>
												• {t('Must not be the same as the username')}<br/>
												• {t('Must not be the same as the previous password')}
											</Typography>
										</Box>
									}
									arrow
									placement="top"
								>
									<InfoIcon fontSize="small" color="action" sx={{ cursor: 'pointer' }} />
								</Tooltip>
							</Box>
						}
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