//---------------------------------------------------------
// License Update Form Component
//---------------------------------------------------------
import {
	Alert,
	Box,
	Button,
	Stack,
	TextField,
	Typography,
	Divider,
	Chip
} from '@mui/material';
import LicenseIcon from '@mui/icons-material/CardMembership';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import {useState, useEffect} from 'react';
import {t} from 'i18next';
import {IUpdateLicenseRequest} from 'types/license';
import {validateLicense} from 'hooks/query/licenseHooks';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface LicenseUpdateFormProps {
	onChange: (data: IUpdateLicenseRequest & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
	mode: 'install' | 'update' | 'upgrade';
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function LicenseUpdateForm(props: LicenseUpdateFormProps) {
	const {onChange, onValidation, mode} = props;
	// Initialize form data (similar to UserEditForm pattern)
	const [formData, setFormData] = useState<IUpdateLicenseRequest>({
		license_key: '',
	});
	
	const [errors, setErrors] = useState<{general?: string; license_key?: string}>({});
	const [isValidating, setIsValidating] = useState(false);
	const [validateError, setValidateError] = useState<any>(null);
	const [validationResult, setValidationResult] = useState<any>(null);
	const [hasValidated, setHasValidated] = useState(false);

	const getModeConfig = () => {
		switch (mode) {
			case 'install':
				return {
					title: t('Install License'),
					icon: <InstallDesktopIcon />,
					description: t('Install a new license key to activate your system'),
					buttonText: t('Install'),
					color: 'primary' as const
				};
			case 'upgrade':
				return {
					title: t('Upgrade License'),
					icon: <UpgradeIcon />,
					description: t('Upgrade your current license to a higher tier'),
					buttonText: t('Upgrade'),
					color: 'secondary' as const
				};
			case 'update':
			default:
				return {
					title: t('Update License'),
					icon: <LicenseIcon />,
					description: t('Update your license key with a new one'),
					buttonText: t('Update'),
					color: 'primary' as const
				};
		}
	};

	const config = getModeConfig();

	// Handle form field changes (similar to UserEditForm pattern)
	const handleLicenseKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setFormData(prev => ({
			...prev,
			license_key: event.target.value,
		}));
	};

	const validateForm = (): boolean => {
		const newErrors: {general?: string; license_key?: string} = {};

		if (!formData.license_key.trim()) {
			newErrors.license_key = t('License key is required');
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleValidate = async () => {
		if (!formData.license_key.trim()) return;
		
		setValidationResult(null);
		setHasValidated(false);
		setValidateError(null);
		
		try {
			setIsValidating(true);
			const result = await validateLicense({license_key: formData.license_key});
			setValidationResult(result);
			setHasValidated(true);
		} catch (error) {
			setValidateError(error);
			setValidationResult(null);
			setHasValidated(true);
		} finally {
			setIsValidating(false);
		}
	};

	// A license is valid if we have validation result and no current validation error
	const isFormValid = hasValidated && validationResult && !validateError;

	// Update parent component when form changes (similar to UserEditForm)
	useEffect(() => {
		const basicValidation = validateForm();
		const overallValid = basicValidation && isFormValid;
		
		onChange({
			...formData,
			isValid: overallValid,
			errors,
		});

		if (onValidation) {
			onValidation(overallValid);
		}
	}, [formData, isFormValid, errors, onChange, onValidation]);

	return (
		<Box sx={{ width: '100%' }}>
			<Stack spacing={3}>
				<Typography variant="h6" display="flex" alignItems="center" gap={1}>
					{config.icon}
					{config.title}
				</Typography>

				{(errors.general) && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{errors.general}
					</Alert>
				)}

				<TextField
					fullWidth
					label={t('License Key')}
					value={formData.license_key}
					onChange={handleLicenseKeyChange}
					multiline
					rows={4}
					placeholder={t('Enter your license key here...')}
					disabled={isValidating}
					error={!!errors.license_key}
					helperText={errors.license_key || t('Paste your complete license key including any formatting')}
					required
				/>

				<Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
					<Button
						variant="outlined"
						onClick={handleValidate}
						disabled={!formData.license_key.trim() || isValidating}
						size="small"
						sx={{ minWidth: 160 }}
					>
						{isValidating ? t('Validating...') : t('Validate License Key')}
					</Button>
				</Box>

				{/* Validation Results */}
				{hasValidated && (
					<Box>
						{isFormValid ? (
						<Alert severity="success" sx={{mb: 2}}>
							<Stack spacing={1}>
								<Typography variant="body2" fontWeight="medium">
									{t('License Key Valid')}
								</Typography>
								{validationResult && (
									<Stack direction="row" spacing={1} flexWrap="wrap">
										<Chip
											size="small"
											label={`${t('User')}: ${validationResult.username}`}
											color="primary"
											variant="outlined"
										/>
										<Chip
											size="small"
											label={`${t('Expires')}: ${new Date(validationResult.expiry).toLocaleDateString()}`}
											color="primary"
											variant="outlined"
										/>
									</Stack>
								)}
							</Stack>
						</Alert>
					) : (
						<Alert severity="error" sx={{mb: 2}}>
							<Typography variant="body2">
								{validateError?.message || t('Invalid license key. Please check and try again.')}
							</Typography>
						</Alert>
					)}
				</Box>
			)}
			</Stack>
		</Box>
	);
}
