//---------------------------------------------------------
// Alert Rule Creation/Edit Form Component
//---------------------------------------------------------
import {
	Stack,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Typography,
	FormControlLabel,
	Checkbox,
} from '@mui/material';
import { t } from 'i18next';
import { useEffect, useState, useCallback } from 'react';
import { ICreateAlertRuleRequest, IUpdateAlertRuleRequest } from 'types/alerts';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface IAlertRuleFormProps {
	initialData?: Partial<ICreateAlertRuleRequest>;
	isEdit?: boolean;
	onChange: (data: { 
		request: ICreateAlertRuleRequest | IUpdateAlertRuleRequest | null; 
		isValid: boolean 
	}) => void;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function AlertRuleForm({ initialData, isEdit = false, onChange }: IAlertRuleFormProps) {
	const [formData, setFormData] = useState<ICreateAlertRuleRequest>({
		name: initialData?.name || '',
		metric_name: initialData?.metric_name || '',
		condition: initialData?.condition || 'gt',
		threshold: initialData?.threshold || 0,
		duration: initialData?.duration || 60,
		severity: initialData?.severity || 'warning',
		message: initialData?.message || '',
		enabled: initialData?.enabled !== undefined ? initialData.enabled : true,
	});

	const [errors, setErrors] = useState<Record<string, string>>({});

	// Validation function
	const validateForm = useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!formData.name.trim()) {
			newErrors.name = t('Alert rule name is required');
		}

		if (!formData.metric_name.trim()) {
			newErrors.metric_name = t('Metric name is required');
		}

		if (isNaN(formData.threshold)) {
			newErrors.threshold = t('Threshold must be a valid number');
		}

		if (formData.duration !== undefined && (isNaN(formData.duration) || formData.duration < 0)) {
			newErrors.duration = t('Duration must be a positive number');
		}

		if (!formData.message?.trim()) {
			newErrors.message = t('Alert message is required');
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [formData]);

	// Update parent component when form changes
	useEffect(() => {
		const isValid = validateForm();
		
		const requestData = {
			...formData,
			// Ensure numeric fields are properly typed
			threshold: isNaN(formData.threshold) ? 0 : formData.threshold,
			duration: formData.duration !== undefined && !isNaN(formData.duration) ? formData.duration : 60,
		};

		onChange({
			request: isValid ? requestData : null,
			isValid,
		});
	}, [formData, onChange, validateForm]);

	// Handle form field changes
	const handleChange = (field: keyof ICreateAlertRuleRequest, value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">
				{isEdit ? t('Edit Alert Rule') : t('Add Alert Rule')}
			</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
				{/* Basic Information */}
				<Stack spacing={2}>
						<TextField
							label={t('Rule Name')}
							value={formData.name}
							onChange={(e) => handleChange('name', e.target.value)}
							size="small"
							required
							error={!!errors.name}
							helperText={errors.name || t('Unique name for the alert rule')}
						/>

						<TextField
							label={t('Metric Name')} 
							value={formData.metric_name}
							onChange={(e) => handleChange('metric_name', e.target.value)}
							size="small"
							required
							error={!!errors.metric_name}
							helperText={errors.metric_name || t('Name of the metric to monitor')}
						/>

						<FormControl size="small" required>
							<InputLabel>{t('Severity')}</InputLabel>
							<Select
								value={formData.severity}
								label={t('Severity')}
								onChange={(e) => handleChange('severity', e.target.value)}
							>
								<MenuItem value="critical">{t('Critical')}</MenuItem>
								<MenuItem value="warning">{t('Warning')}</MenuItem>
								<MenuItem value="info">{t('Info')}</MenuItem>
							</Select>
						</FormControl>

						<TextField
							label={t('Message')}
							value={formData.message || ''}
							onChange={(e) => handleChange('message', e.target.value)}
							size="small"
							multiline
							rows={2}
							required
							error={!!errors.message}
							helperText={errors.message || t('Alert message template')}
							placeholder={t('Alert: {{metric_name}} is {{condition}} {{threshold}}')}
						/>
				</Stack>

				{/* Condition Configuration */}
				<Stack spacing={2}>
						<FormControl size="small" required>
							<InputLabel>{t('Condition')}</InputLabel>
							<Select
								value={formData.condition}
								label={t('Condition')}
								onChange={(e) => handleChange('condition', e.target.value)}
							>
								<MenuItem value="gt">{t('Greater than (>)')}</MenuItem>
								<MenuItem value="gte">{t('Greater than or equal (>=)')}</MenuItem>
								<MenuItem value="lt">{t('Less than (<)')}</MenuItem>
								<MenuItem value="lte">{t('Less than or equal (<=)')}</MenuItem>
								<MenuItem value="eq">{t('Equal to (=)')}</MenuItem>
								<MenuItem value="ne">{t('Not equal to (≠)')}</MenuItem>
							</Select>
						</FormControl>

						<TextField
							label={t('Threshold Value')}
							type="number"
							value={formData.threshold}
							onChange={(e) => handleChange('threshold', parseFloat(e.target.value) || 0)}
							size="small"
							required
							error={!!errors.threshold}
							helperText={errors.threshold || t('Threshold value for the alert condition')}
						/>

						<TextField
							label={t('Duration (seconds)')}
							type="number"
							value={formData.duration || ''}
							onChange={(e) => handleChange('duration', parseFloat(e.target.value) || 60)}
							size="small"
							error={!!errors.duration}
							helperText={errors.duration || t('Duration in seconds before alert triggers (default: 60)')}
						/>
				</Stack>

				{/* Settings */}
				<FormControlLabel
					control={
						<Checkbox
							checked={formData.enabled}
							onChange={(e) => handleChange('enabled', e.target.checked)}
						/>
					}
					label={t('Enable this alert rule')}
				/>
			</Stack>
		</Stack>
	);
}