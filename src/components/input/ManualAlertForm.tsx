//---------------------------------------------------------
// Manual Alert Creation Form Component
//---------------------------------------------------------
import {
	Stack,
	TextField,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Typography,
} from '@mui/material';
import { t } from 'i18next';
import { useEffect, useState, useCallback } from 'react';
import { ICreateManualAlertRequest } from 'types/alerts';

//---------------------------------------------------------
// Component Props Interface
//---------------------------------------------------------
interface IManualAlertFormProps {
	onChange: (data: { request: ICreateManualAlertRequest | null; isValid: boolean }) => void;
}

//---------------------------------------------------------
// Component Implementation
//---------------------------------------------------------
export default function ManualAlertForm({ onChange }: IManualAlertFormProps) {
	const [formData, setFormData] = useState<ICreateManualAlertRequest>({
		rule_name: 'manual',
		metric_name: '',
		severity: 'warning',
		message: '',
		value: undefined,
		threshold: undefined,
		labels: {},
	});

	const [errors, setErrors] = useState<Record<string, string>>({});
	const [labelsInput, setLabelsInput] = useState<string>('');

	// Validation function
	const validateForm = useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!formData.metric_name.trim()) {
			newErrors.metric_name = t('Metric name is required');
		}

		if (!formData.message.trim()) {
			newErrors.message = t('Message is required');
		}

		if (formData.value !== undefined && isNaN(formData.value)) {
			newErrors.value = t('Value must be a valid number');
		}

		if (formData.threshold !== undefined && isNaN(formData.threshold)) {
			newErrors.threshold = t('Threshold must be a valid number');
		}

		// Validate labels JSON if provided
		if (labelsInput.trim()) {
			try {
				const parsedLabels = JSON.parse(labelsInput);
				if (typeof parsedLabels !== 'object' || Array.isArray(parsedLabels)) {
					newErrors.labels = t('Labels must be a valid JSON object');
				}
			} catch {
				newErrors.labels = t('Labels must be valid JSON format');
			}
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [formData, labelsInput]);

	// Update parent component when form changes
	useEffect(() => {
		const isValid = validateForm();
		
		// Parse labels if provided
		let labels: Record<string, string> = {};
		if (labelsInput.trim()) {
			try {
				labels = JSON.parse(labelsInput);
			} catch {
				// Invalid JSON, keep empty labels
			}
		}

		const requestData: ICreateManualAlertRequest = {
			...formData,
			labels,
			// Only include numeric fields if they have valid values
			value: formData.value !== undefined && !isNaN(formData.value) ? formData.value : undefined,
			threshold: formData.threshold !== undefined && !isNaN(formData.threshold) ? formData.threshold : undefined,
		};

		onChange({
			request: isValid ? requestData : null,
			isValid,
		});
	}, [formData, labelsInput, onChange, validateForm]);

	// Handle form field changes
	const handleChange = (field: keyof ICreateManualAlertRequest, value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">
				{t('Create Manual Alert')}
			</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
				{/* Basic Information */}
				<Stack spacing={2}>
						<TextField
							label={t('Rule Name')}
							value={formData.rule_name || ''}
							onChange={(e) => handleChange('rule_name', e.target.value)}
							size="small"
							helperText={t('Optional: Rule name for grouping (defaults to "manual")')}
						/>

						<TextField
							label={t('Metric Name')} 
							value={formData.metric_name}
							onChange={(e) => handleChange('metric_name', e.target.value)}
							size="small"
							required
							error={!!errors.metric_name}
							helperText={errors.metric_name || t('Name of the metric this alert relates to')}
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
							value={formData.message}
							onChange={(e) => handleChange('message', e.target.value)}
							size="small"
							multiline
							rows={3}
							required
							error={!!errors.message}
							helperText={errors.message || t('Alert message describing the issue')}
						/>
				</Stack>

				{/* Metric Values */}
				<Stack spacing={2}>
						<TextField
							label={t('Current Value')}
							type="number"
							value={formData.value || ''}
							onChange={(e) => handleChange('value', parseFloat(e.target.value) || undefined)}
							size="small"
							error={!!errors.value}
							helperText={errors.value || t('Current metric value that triggered the alert')}
						/>

						<TextField
							label={t('Threshold Value')}
							type="number"
							value={formData.threshold || ''}
							onChange={(e) => handleChange('threshold', parseFloat(e.target.value) || undefined)}
							size="small"
							error={!!errors.threshold}
							helperText={errors.threshold || t('Threshold value (if applicable)')}
						/>
				</Stack>

				{/* Labels */}
				<TextField
					label={t('Additional Labels (Optional)')}
					value={labelsInput}
					onChange={(e) => setLabelsInput(e.target.value)}
					size="small"
					multiline
					rows={2}
					placeholder='{"key1": "value1", "key2": "value2"}'
					error={!!errors.labels}
					helperText={errors.labels || t('Additional labels or metadata in JSON format')}
				/>
			</Stack>
		</Stack>
	);
}