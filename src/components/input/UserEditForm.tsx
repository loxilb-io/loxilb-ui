//---------------------------------------------------------
// User Edit Form Component
//---------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import {
	Alert,
	Button,
	InputAdornment,
	TextField,
	Box,
	Typography,
	Stack,
	Divider,
	Tooltip,
	IconButton,

} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

import { t } from 'i18next';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useFormWithParams from 'hooks/inputFormHook';
import {
	validate_email,
	validate_password,
	validate_username,
} from 'connector/user';
import {IUser} from 'types/oam';
import {IUserUpdateRequest} from 'types/user';
import {IEnumItem} from 'types/global';
import DropDownSelectBox from 'components/element/DropDownSelectBox';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface UserEditFormProps {
	user: IUser;
	onChange: (data: IUserUpdateRequest & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
	isAdmin?: boolean;
	isCurrentUser?: boolean;
}

//---------------------------------------------------------
// Form Data Interface
//---------------------------------------------------------
interface IFormData {
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
	role: string;
}

interface IFormErrors {
	username?: string;
	email?: string;
	password?: string;
	confirmPassword?: string;
	general?: string;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function UserEditForm(props: UserEditFormProps) {
	const {user, onChange, onValidation, isAdmin = false, isCurrentUser = false} = props;
	
	// Initialize form data with user data (similar to LBInputForm pattern)
	const [formData, setFormData] = useState<IUserUpdateRequest>({
		username: user.username || '',
		email: user.email || '',
		password: '',
		role: user.role || 'user',
	});

	// Role options for DropDownSelectBox
	const roleOptions: IEnumItem[] = [
		{ id: 0, name: t('User'), send_value: 'user' },
		{ id: 1, name: t('Admin'), send_value: 'admin' }
	];

	const [errors, setErrors] = useState<IFormErrors>({});
	const [changePassword, setChangePassword] = useState(false);
	const [confirmPassword, setConfirmPassword] = useState('');

	// Handle form field changes (similar to LBInputForm pattern)
	const handleChange = (field: keyof IUserUpdateRequest) => (value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	const handleInputChange = (field: keyof IUserUpdateRequest) => (event: React.ChangeEvent<HTMLInputElement>) => {
		handleChange(field)(event.target.value);
	};

	const handleConfirmPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setConfirmPassword(event.target.value);
	};

	const validateForm = (): boolean => {
		const newErrors: IFormErrors = {};

		// Validate username
		if (formData.username) {
			const usernameValidation = validate_username(formData.username);
			if (!usernameValidation.isValid) {
				newErrors.username = usernameValidation.message;
			}
		}

		// Validate email
		if (formData.email && !validate_email(formData.email)) {
			newErrors.email = t('Please enter a valid email address');
		}

		// Validate password if changing
		if (changePassword) {
			if (!formData.password) {
				newErrors.password = t('Password is required');
			} else {
				const passwordValidation = validate_password(formData.password);
				if (!passwordValidation.isValid) {
					newErrors.password = passwordValidation.message;
				}
			}

			if (formData.password !== confirmPassword) {
				newErrors.confirmPassword = t('Passwords do not match');
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Update parent component when form changes (similar to other forms)
	useEffect(() => {
		const isValid = validateForm();
		
		onChange({
			...formData,
			isValid,
			errors,
		});

		if (onValidation) {
			onValidation(isValid);
		}
	}, [formData, confirmPassword, changePassword, onChange, onValidation]);


	return (
		<Box sx={{ width: '100%' }}>
			<Stack spacing={3}>
				<Typography variant="h6" display="flex" alignItems="center" gap={1}>
					<PersonIcon />
					{t('Edit User')} - {user.username}
				</Typography>

				{(errors.general) && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{errors.general}
				</Alert>
			)}

				<TextField
					fullWidth
					label={t('Username')}
					value={formData.username}
					onChange={handleInputChange('username')}
					error={!!errors.username}
					helperText={errors.username || (isCurrentUser && formData.username !== user.username ? t('Note: Changing your username requires setting a password for re-authentication') : '')}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<PersonIcon fontSize="small" />
							</InputAdornment>
						),
					}}
					required
				/>

				<TextField
					fullWidth
					label={t('Email')}
					type="email"
					value={formData.email}
					onChange={handleInputChange('email')}
					error={!!errors.email}
					helperText={errors.email}
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<EmailIcon fontSize="small" />
							</InputAdornment>
						),
					}}
					required
				/>

				{isAdmin && !isCurrentUser && (
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<AdminPanelSettingsIcon fontSize="small" color="action" />
						<Box sx={{ flex: 1 }}>
							<DropDownSelectBox 
								label={t('Role')} 
								item_list={roleOptions} 
								value={formData.role} 
								disabled={false}
								onChange={(value) => setFormData(prev => ({...prev, role: value}))}
							/>
						</Box>
					</Box>
				)}

				<Divider sx={{ my: 3 }} />

				{/* Password Section */}
				<Box sx={{ 
					p: 2, 
					border: '1px solid', 
					borderColor: changePassword ? 'primary.main' : 'divider',
					borderRadius: 2,
					backgroundColor: changePassword ? 'primary.50' : 'grey.50',
					transition: 'all 0.2s ease-in-out'
				}}>
					<Box display="flex" alignItems="center" justifyContent="space-between" mb={changePassword ? 2 : 0}>
						<Box display="flex" alignItems="center" gap={1}>
							<LockIcon fontSize="small" color={changePassword ? 'primary' : 'disabled'} />
							<Typography variant="subtitle2" color={changePassword ? 'primary.main' : 'text.secondary'}>
								{t('Password Settings')}
							</Typography>
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
								<IconButton size="small" sx={{ ml: 0.5 }}>
									<InfoIcon fontSize="small" color="action" />
								</IconButton>
							</Tooltip>
						</Box>
						<Button
							variant={changePassword ? 'contained' : 'outlined'}
							size="small"
							onClick={() => {
								setChangePassword(!changePassword);
								if (changePassword) {
									// Clear password fields when canceling
									setFormData(prev => ({
										...prev,
										password: '',
										confirmPassword: ''
									}));
									setErrors(prev => ({
										...prev,
										password: undefined,
										confirmPassword: undefined
									}));
								}
							}}
							sx={{ minWidth: 140 }}
						>
							{changePassword ? t('Cancel') : t('Change Password')}
						</Button>
					</Box>

					{changePassword && (
						<Stack spacing={2} sx={{ mt: 2 }}>
							<Alert severity="info" sx={{ fontSize: '0.875rem' }}>
								{t('Leave password fields empty to keep current password unchanged')}
							</Alert>
							
							<TextField
								fullWidth
								label={t('New Password')}
								type="password"
								value={formData.password}
								onChange={handleInputChange('password')}
								error={!!errors.password}
								helperText={errors.password || t('Minimum 9 characters with letters and numbers')}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<LockIcon fontSize="small" />
										</InputAdornment>
									),
								}}
								placeholder={t('Enter new password')}
							/>

							<TextField
								fullWidth
								label={t('Confirm New Password')}
								type="password"
								value={confirmPassword}
								onChange={handleConfirmPasswordChange}
								error={!!errors.confirmPassword}
								helperText={errors.confirmPassword}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<LockIcon fontSize="small" />
										</InputAdornment>
									),
								}}
								required
							/>
						</Stack>
					)}
				</Box>

	
			</Stack>

		</Box>
	);
}