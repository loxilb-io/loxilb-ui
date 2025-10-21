//---------------------------------------------------------
// Alert Rule Creation/Edit Form Component
//---------------------------------------------------------
import {
	Stack,
	TextField,
	Typography,
	FormControlLabel,
	Checkbox,
} from '@mui/material';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
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

						{/* <TextField
							label={t('Metric Name')} 
							value={formData.metric_name}
							onChange={(e) => handleChange('metric_name', e.target.value)}
							size="small"
							required
							error={!!errors.metric_name}
							helperText={errors.metric_name || t('Name of the metric to monitor')}
						/> */}
						<DropDownSelectBox 
							label={t('Metric Name')} 
							value={formData.metric_name} 
							onChange={(value) => handleChange('metric_name', value)} 
							item_list={[
								{id: 1, name: 'UNHEALTHY_ENDPOINTS_COUNT', send_value: 'unhealthy_endpoints_count'}

								// {id: 1, name: 'ACTIVE_CONNTRACK_COUNT', send_value: 'active_conntrack_count'},
								// {id: 2, name: 'ACTIVE_FLOW_COUNT_TCP', send_value: 'active_flow_count_tcp'},
								// {id: 3, name: 'ACTIVE_FLOW_COUNT_UDP', send_value: 'active_flow_count_udp'},
								// {id: 4, name: 'ACTIVE_FLOW_COUNT_SCTP', send_value: 'active_flow_count_sctp'},
								// {id: 5, name: 'INACTIVE_FLOW_COUNT', send_value: 'inactive_flow_count'},
								// {id: 6, name: 'NEW_FLOW_COUNT', send_value: 'new_flow_count'},
								// {id: 7, name: 'LB_RULE_COUNT', send_value: 'lb_rule_count'},
								// {id: 8, name: 'TOTAL_REQUEST', send_value: 'total_requests'},
								// {id: 9, name: 'TOTAL_ERRORS', send_value: 'total_errors'},
								// {id: 10, name: 'UNHEALTHY_ENDPOINTS_COUNT', send_value: 'unhealthy_endpoints_count'},
								// {id: 11, name: 'TOTAL_FW_DROPS', send_value: 'total_fw_drops'},
								// {id: 12, name: 'BPS', send_value: 'rps_bps'},
								// {id: 13, name: 'PPS', send_value: 'rps_pps'},
								// {id: 14, name: 'EPS', send_value: 'rps_eps'},
								// {id: 15, name: 'TCP_BPS', send_value: 'rps_tcp_bps'},
								// {id: 16, name: 'UDP_BPS', send_value: 'rps_udp_bps'},
								// {id: 17, name: 'SCTP_BPS', send_value: 'rps_sctp_bps'},
								// {id: 18, name: 'TCP_PPS', send_value: 'rps_tcp_pps'},
								// {id: 19, name: 'UDP_PPS', send_value: 'rps_udp_pps'},
								// {id: 20, name: 'SCTP_PPS', send_value: 'rps_sctp_pps'}
							]}
						/>

						<DropDownSelectBox 
							label={t('Severity')} 
							value={formData.severity} 
							onChange={(value) => handleChange('severity', value)} 
							item_list={[
								{id: 1, name: t('Critical'), send_value: 'critical'},
								{id: 2, name: t('Warning'), send_value: 'warning'},
								{id: 3, name: t('Info'), send_value: 'info'}
							]}
						/>

						<DropDownSelectBox 
							label={t('Message Template')} 
							value={formData.message || ''} 
							onChange={(value) => handleChange('message', value)} 
							item_list={[
								{id: 1, name: t('Basic Alert'), send_value: 'Alert: {{metric_name}} is {{condition}} {{threshold}}'},
								{id: 2, name: t('Detailed Alert'), send_value: 'ALERT: {{metric_name}} has reached {{condition}} {{threshold}} for {{duration}} seconds'},
								{id: 3, name: t('Critical System Alert'), send_value: 'CRITICAL: System metric {{metric_name}} is {{condition}} {{threshold}} - Immediate attention required'},
								{id: 4, name: t('Performance Warning'), send_value: 'WARNING: Performance metric {{metric_name}} is {{condition}} {{threshold}} - Please investigate'},
								{id: 5, name: t('Threshold Exceeded'), send_value: 'Threshold Exceeded: {{metric_name}} value is {{condition}} {{threshold}}'}
							]}
						/>

						<TextField
							label={t('Custom Message')}
							value={formData.message || ''}
							onChange={(e) => handleChange('message', e.target.value)}
							size="small"
							multiline
							rows={2}
							required
							error={!!errors.message}
							helperText={errors.message || t('Customize the alert message. Use {{metric_name}}, {{condition}}, {{threshold}}, {{duration}} as placeholders')}
							placeholder={t('Alert: {{metric_name}} is {{condition}} {{threshold}}')}
						/>
				</Stack>

				{/* Condition Configuration */}
				<Stack spacing={2}>
						<DropDownSelectBox 
							label={t('Condition')} 
							value={formData.condition} 
							onChange={(value) => handleChange('condition', value)} 
							item_list={[
								{id: 1, name: t('Greater than (>)'), send_value: 'gt'},
								{id: 2, name: t('Greater than or equal (>=)'), send_value: 'gte'},
								{id: 3, name: t('Less than (<)'), send_value: 'lt'},
								{id: 4, name: t('Less than or equal (<=)'), send_value: 'lte'},
								{id: 5, name: t('Equal to (=)'), send_value: 'eq'},
								{id: 6, name: t('Not equal to (≠)'), send_value: 'ne'}
							]}
						/>

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