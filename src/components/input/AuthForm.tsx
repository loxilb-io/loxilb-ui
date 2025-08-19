//---------------------------------------------------------
// Combined Authentication Form Component
//---------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import EmailIcon from '@mui/icons-material/Email';
import {
	Alert,
	Button,
	InputAdornment,
	TextField,
	Box,
	Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { t } from 'i18next';
import { useEffect, useState, useCallback } from 'react';
import {
	AuthMode,
	IAuthFormData,
	IAuthFormErrors,
	ICreateUserRequest,
	ILoginRequest,
} from 'types/user';
import {
	validate_email,
	validate_password,
	validate_username,
} from 'connector/user';

//---------------------------------------------------------
// Styled Components
//---------------------------------------------------------
const FormBox = styled('form')(({ theme }) => ({
	width: '100%',
	marginTop: theme.spacing(1),
}));

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface IAuthFormProps {
	mode: AuthMode;
	onSubmit: (data: ILoginRequest | ICreateUserRequest) => Promise<void>;
	loading: boolean;
	error: string;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function AuthForm({ mode, onSubmit, loading, error }: IAuthFormProps) {
	const [formData, setFormData] = useState<IAuthFormData>({
		username: '',
		password: '',
		email: '',
		confirmPassword: '',
	});

	const [errors, setErrors] = useState<IAuthFormErrors>({});
	const [touched, setTouched] = useState<Record<string, boolean>>({});

	// Form validation
	const validateForm = useCallback((): boolean => {
		const newErrors: IAuthFormErrors = {};

		// Username validation
		if (!formData.username.trim()) {
			newErrors.username = t('Username is required');
		} else {
			const usernameValidation = validate_username(formData.username);
			if (!usernameValidation.isValid) {
				newErrors.username = usernameValidation.message;
			}
		}

		// Password validation
		if (!formData.password) {
			newErrors.password = t('Password is required');
		} else if (mode === 'signup') {
			const passwordValidation = validate_password(formData.password);
			if (!passwordValidation.isValid) {
				newErrors.password = passwordValidation.message;
			}
		}

		// Signup-specific validation
		if (mode === 'signup') {
			// Email validation (required for signup)
			if (!formData.email.trim()) {
				newErrors.email = t('Email is required');
			} else if (!validate_email(formData.email)) {
				newErrors.email = t('Please enter a valid email address');
			}

			// Confirm password validation
			if (!formData.confirmPassword) {
				newErrors.confirmPassword = t('Please confirm your password');
			} else if (formData.password !== formData.confirmPassword) {
				newErrors.confirmPassword = t('Passwords do not match');
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [formData, mode]);

	// Real-time validation on blur
	const handleBlur = (field: keyof IAuthFormData) => {
		setTouched(prev => ({ ...prev, [field]: true }));
		validateForm();
	};

	// Handle form field changes
	const handleChange = (field: keyof IAuthFormData, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }));
		
		// Clear error when user starts typing
		if (errors[field]) {
			setErrors(prev => ({ ...prev, [field]: undefined }));
		}

		// Trigger validation if field has been touched
		if (touched[field]) {
			setTimeout(() => validateForm(), 0);
		}
	};

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		
		if (!validateForm()) {
			return;
		}

		try {
			if (mode === 'login') {
				await onSubmit({
					username: formData.username,
					password: formData.password,
				} as ILoginRequest);
			} else {
				await onSubmit({
					username: formData.username,
					password: formData.password,
					email: formData.email,
				} as ICreateUserRequest);
			}
		} catch (error) {
			// Error handling is done by parent component
		}
	};

	// Reset form when mode changes
	useEffect(() => {
		setFormData({
			username: '',
			password: '',
			email: '',
			confirmPassword: '',
		});
		setErrors({});
		setTouched({});
	}, [mode]);

	const isFormValid = useCallback(() => {
		if (mode === 'login') {
			return formData.username.trim() && formData.password;
		} else {
			// Check if all required fields are filled
			const hasAllFields = 
				formData.username.trim() &&
				formData.password &&
				formData.email.trim() &&
				formData.confirmPassword;

			if (!hasAllFields) {
				return false;
			}

			// Only check for errors if fields have been touched or if we're doing a final validation
			const touchedFields = Object.keys(touched);
			if (touchedFields.length === 0) {
				// If no fields touched yet, just check if all fields are filled
				return true;
			}

			// Check if there are any actual error messages for touched fields
			const hasErrors = Object.entries(errors).some(([field, error]) => 
				touched[field as keyof IAuthFormData] && error && error.trim()
			);

			return !hasErrors;
		}
	}, [formData, errors, mode, touched]);

	return (
		<Box>
			{error && (
				<Alert severity="error" sx={{ mt: 2, width: '100%' }}>
					{error}
				</Alert>
			)}

			<FormBox onSubmit={handleSubmit} sx={{ width: '280px' }}>
				{/* Username Field */}
				<TextField
					margin="normal"
					required
					fullWidth
					id="username"
					label={t('Username')}
					name="username"
					autoComplete="username"
					autoFocus
					value={formData.username}
					error={touched.username && !!errors.username}
					helperText={touched.username && errors.username}
					slotProps={{
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<PersonIcon color="disabled" />
								</InputAdornment>
							),
						},
					}}
					onChange={(e) => handleChange('username', e.target.value)}
					onBlur={() => handleBlur('username')}
					disabled={loading}
				/>

				{/* Email Field (Signup only) */}
				{mode === 'signup' && (
					<TextField
						margin="normal"
						required
						fullWidth
						id="email"
						label={t('Email')}
						name="email"
						type="email"
						autoComplete="email"
						value={formData.email}
						error={touched.email && !!errors.email}
						helperText={touched.email && errors.email}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<EmailIcon color="disabled" />
									</InputAdornment>
								),
							},
						}}
						onChange={(e) => handleChange('email', e.target.value)}
						onBlur={() => handleBlur('email')}
						disabled={loading}
					/>
				)}

				{/* Password Field */}
				<TextField
					margin="normal"
					required
					fullWidth
					name="password"
					label={t('Password')}
					type="password"
					id="password"
					autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
					value={formData.password}
					error={touched.password && !!errors.password}
					helperText={touched.password && errors.password}
					slotProps={{
						input: {
							startAdornment: (
								<InputAdornment position="start">
									<LockIcon color="disabled" />
								</InputAdornment>
							),
						},
					}}
					onChange={(e) => handleChange('password', e.target.value)}
					onBlur={() => handleBlur('password')}
					disabled={loading}
				/>

				{/* Confirm Password Field (Signup only) */}
				{mode === 'signup' && (
					<TextField
						margin="normal"
						required
						fullWidth
						name="confirmPassword"
						label={t('Confirm Password')}
						type="password"
						id="confirmPassword"
						autoComplete="new-password"
						value={formData.confirmPassword}
						error={touched.confirmPassword && !!errors.confirmPassword}
						helperText={touched.confirmPassword && errors.confirmPassword}
						slotProps={{
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<LockIcon color="disabled" />
									</InputAdornment>
								),
							},
						}}
						onChange={(e) => handleChange('confirmPassword', e.target.value)}
						onBlur={() => handleBlur('confirmPassword')}
						disabled={loading}
					/>
				)}

				{/* Submit Button */}
				<Button
					type="submit"
					fullWidth
					variant="contained"
					sx={{ mt: 3, mb: 2 }}
					disabled={loading || !isFormValid()}
				>
					{loading
						? t('Loading...')
						: mode === 'login'
						? t('Login')
						: t('Create Account')}
				</Button>
			</FormBox>
		</Box>
	);
}