//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import React, { useState, useEffect } from 'react';
import { Stack, Typography, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { t } from 'i18next';
import { IAlert, IResolveAlertRequest } from 'types/alerts';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
interface AlertResolveFormProps {
	selectedAlerts: IAlert[];
	onChange: (data: { 
		type: 'individual' | 'rule';
		requests?: IResolveAlertRequest[];
		request?: IResolveAlertRequest;
		isValid?: boolean;
	}) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function AlertResolveForm(props: AlertResolveFormProps) {
	const { selectedAlerts, onChange, onValidation } = props;
	
	const [resolvedBy, setResolvedBy] = useState<string>('administrator');
	const [reason, setReason] = useState<string>('');
	const [resolveMethod, setResolveMethod] = useState<'ids' | 'rule'>('ids');
	const [ruleName, setRuleName] = useState<string>('');

	// Extract alert IDs from selected alerts
	const alertIds = selectedAlerts.map(alert => alert.id).filter(id => id !== undefined) as string[];
	
	// Get unique rule names from selected alerts
	const uniqueRuleNames = [...new Set(selectedAlerts.map(alert => alert.rule_name).filter(name => name))];

	// Validation
	const isValid = React.useMemo(() => {
		if (!resolvedBy.trim()) return false;
		if (resolveMethod === 'ids' && alertIds.length === 0) return false;
		if (resolveMethod === 'rule' && !ruleName.trim()) return false;
		return true;
	}, [resolvedBy, resolveMethod, alertIds.length, ruleName]);

	// Build request data - for multiple alerts, we'll send array of individual requests
	const requestData = React.useMemo(() => {
		const baseRequest = {
			resolved_by: resolvedBy.trim(),
			reason: reason.trim() || undefined,
		};

		if (resolveMethod === 'ids') {
			// Return array of individual requests for each alert
			return {
				type: 'individual' as const,
				requests: alertIds.map(alertId => ({
					...baseRequest,
					alert_id: alertId,
				})),
			};
		} else {
			// Return single request for rule-based resolution
			return {
				type: 'rule' as const,
				request: {
					...baseRequest,
					rule_name: ruleName.trim(),
				},
			};
		}
	}, [resolvedBy, reason, resolveMethod, alertIds, ruleName]);

	// Notify parent of changes
	useEffect(() => {
		onChange({ ...requestData, isValid });
		if (onValidation) {
			onValidation(isValid);
		}
	}, [requestData, isValid, onChange, onValidation]);

	// Auto-select rule name if all selected alerts have the same rule
	useEffect(() => {
		if (uniqueRuleNames.length === 1) {
			setRuleName(uniqueRuleNames[0]);
		}
	}, [uniqueRuleNames]);

	return (
		<Stack width="100%" spacing={2}>
			<Typography variant="h6">{t('Resolve Alerts')}</Typography>

			{/* Alert Summary */}
			<Stack spacing={1}>
				<Typography variant="subtitle2" color="text.secondary">
					{t('Selected Alerts')}: {selectedAlerts.length}
				</Typography>
				{selectedAlerts.slice(0, 3).map((alert, index) => (
					<Typography key={index} variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
						• {alert.rule_name} ({alert.severity}) - {alert.message?.substring(0, 60)}...
					</Typography>
				))}
				{selectedAlerts.length > 3 && (
					<Typography variant="body2" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
						...and {selectedAlerts.length - 3} more
					</Typography>
				)}
			</Stack>

			{/* Resolution Method */}
			<FormControl fullWidth>
				<InputLabel>{t('Resolution Method')}</InputLabel>
				<Select
					value={resolveMethod}
					label={t('Resolution Method')}
					onChange={(e) => setResolveMethod(e.target.value as 'ids' | 'rule')}
				>
					<MenuItem value="ids">{t('Resolve Selected Alerts')}</MenuItem>
					{uniqueRuleNames.length > 0 && (
						<MenuItem value="rule">{t('Resolve All Alerts by Rule')}</MenuItem>
					)}
				</Select>
			</FormControl>

			{/* Rule Name (when resolving by rule) */}
			{resolveMethod === 'rule' && (
				<FormControl fullWidth>
					<InputLabel>{t('Rule Name')}</InputLabel>
					<Select
						value={ruleName}
						label={t('Rule Name')}
						onChange={(e) => setRuleName(e.target.value)}
					>
						{uniqueRuleNames.map((name) => (
							<MenuItem key={name} value={name}>
								{name}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			)}

			{/* Resolved By */}
			<TextField
				label={t('Resolved By')}
				value={resolvedBy}
				onChange={(e) => setResolvedBy(e.target.value)}
				fullWidth
				required
				helperText={t('Identifier of the user or system resolving the alert')}
			/>

			{/* Reason (Optional) */}
			<TextField
				label={t('Resolution Reason')}
				value={reason}
				onChange={(e) => setReason(e.target.value)}
				fullWidth
				multiline
				rows={3}
				helperText={t('Optional reason for resolving these alerts')}
				placeholder={t('e.g., False positive, Issue resolved, Maintenance window, etc.')}
			/>

			{/* Summary */}
			<Stack spacing={1} sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
				<Typography variant="subtitle2" color="primary">
					{t('Resolution Summary')}
				</Typography>
				<Typography variant="body2">
					{resolveMethod === 'ids' 
						? t('Will resolve {{count}} selected alert(s) with {{apiCalls}} API call(s)', { count: alertIds.length, apiCalls: alertIds.length })
						: t('Will resolve ALL alerts for rule: {{rule}}', { rule: ruleName })
					}
				</Typography>
				<Typography variant="body2">
					{t('Resolved by')}: {resolvedBy || t('(required)')}
				</Typography>
				{reason && (
					<Typography variant="body2">
						{t('Reason')}: {reason}
					</Typography>
				)}
			</Stack>
		</Stack>
	);
}