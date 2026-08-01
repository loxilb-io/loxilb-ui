//---------------------------------------------------------
// Login Form Component
//---------------------------------------------------------
// This is a closed system: accounts are provisioned by an administrator
// (see docs/SECURITY_RBAC_PLAN.md), so this form is login-only. Signup was
// removed along with OAuth; new users are created from the User Management page.
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import {Alert, Button, Box, InputAdornment, TextField} from '@mui/material';
import {styled} from '@mui/material/styles';
import {t} from 'i18next';
import {useState} from 'react';
import {ILoginRequest} from 'types/user';
import {validate_username} from 'connector/user';

//---------------------------------------------------------
// Styled Components
//---------------------------------------------------------
const FormBox = styled('form')(({theme}) => ({
	width: '100%',
	marginTop: theme.spacing(1),
}));

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface IAuthFormProps {
	mode?: 'login'; // retained for call-site compatibility; login is the only mode
	onSubmit: (data: ILoginRequest) => Promise<void>;
	loading: boolean;
	error: string;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function AuthForm({onSubmit, loading, error}: IAuthFormProps) {
	const [formData, setFormData] = useState<ILoginRequest>({username: '', password: ''});
	const [errors, setErrors] = useState<{username?: string; password?: string}>({});
	const [touched, setTouched] = useState<{username?: boolean; password?: boolean}>({});

	// Login only checks presence + username format; the backend is the
	// authority on credential correctness. Password-strength rules live on the
	// admin create-user form, not here.
	const validateForm = (): boolean => {
		const newErrors: {username?: string; password?: string} = {};
		if (!formData.username.trim()) {
			newErrors.username = t('Username is required');
		} else {
			const usernameValidation = validate_username(formData.username);
			if (!usernameValidation.isValid) newErrors.username = usernameValidation.message;
		}
		if (!formData.password) newErrors.password = t('Password is required');
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleBlur = (field: keyof ILoginRequest) => {
		setTouched(prev => ({...prev, [field]: true}));
		validateForm();
	};

	const handleChange = (field: keyof ILoginRequest, value: string) => {
		setFormData(prev => ({...prev, [field]: value}));
		if (errors[field]) setErrors(prev => ({...prev, [field]: undefined}));
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!validateForm()) return;
		try {
			await onSubmit({username: formData.username, password: formData.password});
		} catch {
			// Error surfaced by the parent via the `error` prop
		}
	};

	const isFormValid = () => formData.username.trim() && formData.password;

	return (
		<Box>
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
					onChange={e => handleChange('username', e.target.value)}
					onBlur={() => handleBlur('username')}
					disabled={loading}
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
					onChange={e => handleChange('password', e.target.value)}
					onBlur={() => handleBlur('password')}
					disabled={loading}
				/>

				<Button type="submit" fullWidth variant="contained" sx={{mt: 3, mb: 2}} disabled={loading || !isFormValid()}>
					{loading ? t('Loading...') : t('Login')}
				</Button>
			</FormBox>
		</Box>
	);
}
