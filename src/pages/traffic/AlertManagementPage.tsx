//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import { Stack, Box, FormControl, InputLabel, Select, MenuItem, TextField, Button, Chip } from '@mui/material';
import { getStableHash } from 'common';
import SubTabs from 'components/element/SubTabs';
import AlertResolveForm from 'components/input/AlertResolveForm';
import LowerSection from 'components/layout/LowerSection';
import AlertActionsPanel from 'components/panel/AlertActionsPanel';
import AlertHistoryPanel from 'components/panel/AlertHistoryPanel';
import AlertSettingsPanel from 'components/panel/AlertSettingsPanel';
import AlertTable, { IAlertData } from 'components/table/traffic/AlertTable';
import { resolveAlert, createManualAlert } from 'hooks/query/alertHooks';
import ManualAlertForm from 'components/input/ManualAlertForm';
import { useInstanceFromURL } from 'hooks/instanceHook';
import { usePopUp } from 'hooks/popupHook';
import { useAllAlertsMain } from 'hooks/query/alertHooks';
import { t } from 'i18next';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IAlert, IResolveAlertRequest, ICreateManualAlertRequest, IAlertQueryParams } from 'types/alerts';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AlertManagementPage() {
	const inst = useInstanceFromURL();

	const [searchParams] = useSearchParams();
	const alertId = searchParams.get('alertId');

	// Query parameters for filtering
	const [queryParams, setQueryParams] = useState<IAlertQueryParams>({
		limit: 100,
		offset: 0,
	});

	// Filter states
	const [statusFilter, setStatusFilter] = useState<string>('');
	const [severityFilter, setSeverityFilter] = useState<string>('');
	const [ruleNameFilter, setRuleNameFilter] = useState<string>('');
	const [metricNameFilter, setMetricNameFilter] = useState<string>('');

	const { data: alert_data, refetch } = useAllAlertsMain(inst, queryParams);
	const alert_info: IAlertData = useMemo(() => ({ alerts: alert_data?.data ?? [] }), [alert_data]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	const tabs = ['Details', 'History', 'Actions'];

	// Hash function for alert
	const getHashKey = (item: IAlert) => {
		const str = `${item.id || ''}_${item.rule_name || ''}_${item.triggered_at || ''}`;
		return getStableHash(str);
	};

	// Selected alert info
	const selected_alert = selected_rows.length === 1 && alert_info.alerts[selected_rows[0]] ? alert_info.alerts[selected_rows[0]] : null;

	useEffect(() => {
		if (!alert_info || alert_info.alerts.length === 0) return;
		if (selected_rows.length === 1) {
			const item = alert_info.alerts[selected_rows[0]];
			set_selected_key(getHashKey(item).toString());
			set_cur_tab_idx(0);
		} else if (selected_key !== null) {
			set_selected_key(null);
			set_cur_tab_idx(0);
		}
	}, [alert_info, selected_rows, selected_key]);

	const { openPopUp, enableYes } = usePopUp();
	const resolveFormRef = useRef<{
		type: 'individual' | 'rule';
		requests?: IResolveAlertRequest[];
		request?: IResolveAlertRequest;
		isValid?: boolean;
	} | null>(null);
	const instanceRef = useRef<ICreateManualAlertRequest | null>(null);

	// Apply filters
	const applyFilters = useCallback(() => {
		const newParams: IAlertQueryParams = {
			limit: 100,
			offset: 0,
		};

		// Only add filter parameters if they have values
		if (statusFilter) {
			newParams.status = statusFilter as 'active' | 'resolved';
		}
		if (severityFilter) {
			newParams.severity = severityFilter as 'critical' | 'warning' | 'info';
		}
		if (ruleNameFilter) {
			newParams.rule_name = ruleNameFilter;
		}
		if (metricNameFilter) {
			newParams.metric_name = metricNameFilter;
		}

		setQueryParams(newParams);
	}, [statusFilter, severityFilter, ruleNameFilter, metricNameFilter]);

	// Clear filters
	const clearFilters = useCallback(() => {
		setStatusFilter('');
		setSeverityFilter('');
		setRuleNameFilter('');
		setMetricNameFilter('');
		setQueryParams({
			limit: 100,
			offset: 0,
		});
	}, []);

	// Active filter count
	const activeFilterCount = [statusFilter, severityFilter, ruleNameFilter, metricNameFilter].filter(f => f).length;

	// Alert resolution handler
	const handleResolve = useCallback(async () => {
		if (!inst || selected_rows.length === 0) return;

		const selectedAlerts = selected_rows.map(index => alert_info.alerts[index]).filter(alert => alert);
		
		const resolve_form = (
			<AlertResolveForm
				key={Date.now()}
				selectedAlerts={selectedAlerts}
				onChange={data => {
					resolveFormRef.current = data;
					enableYes(data.isValid); 
				}}
			/>
		);

		openPopUp(
			'',
			resolve_form,
			t('Resolve'),
			t('Cancel'),
			async () => {
				if (!resolveFormRef.current) return;



				try {
					const requestData = resolveFormRef.current;
					if (!requestData) return;
					
					let results: any[] = [];

					if (requestData.type === 'individual' && requestData.requests) {
						// Make multiple API calls for individual alerts
						for (const request of requestData.requests) {
							const res = await resolveAlert(inst, request);
							results.push(res);
						}
						
						// Check if all requests succeeded
						const successCount = results.filter(res => res.success).length;
						const totalCount = results.length;
						
						if (successCount === totalCount) {
							openPopUp(t('Success'), t('All {{count}} alert(s) resolved successfully.', { count: totalCount }), t('OK'));
						} else {
							openPopUp(t('Partial Success'), t('{{success}} of {{total}} alerts resolved successfully.', { success: successCount, total: totalCount }), t('OK'));
						}
						
					} else if (requestData.type === 'rule' && requestData.request) {
						// Single API call for rule-based resolution
						const res = await resolveAlert(inst, requestData.request);
						results = [res];
						
						if (res.success) {
							openPopUp(t('Success'), t('All alerts for rule resolved successfully.'), t('OK'));
						} else {
							openPopUp(t('Error'), t('Failed to resolve alerts by rule. {{error}}', { error: res.message }), t('OK'));
						}
					}

					// Clear selection and refresh if any succeeded
					const anySucceeded = results.some(res => res.success);
					if (anySucceeded) {
						set_selected_rows([]);
						setTimeout(() => {
							refetch();
						}, 1000);
					}
					
				} catch (error) {
					console.error('Resolve error:', error);
					openPopUp(t('Error'), t('Failed to resolve alert(s). Please try again.'), t('OK'));
				}
			},
			true,
		);
	}, [inst, selected_rows, alert_info, openPopUp, refetch, enableYes]);

	// Manual alert creation handler
	const handleAdd = useCallback(() => {
		if (!inst) return;

		// Manual alert creation form
		const input_form = (
			<ManualAlertForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data.request;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Create Manual Alert'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				try {
					const res = await createManualAlert(inst, instanceRef.current);
					if (res.success) {
						openPopUp(t('Success'), t('Manual alert created successfully.'), t('OK'));
						setTimeout(() => {
							refetch();
						}, 1000);
					} else {
						openPopUp(t('Error'), t('Failed to create alert. {{error}}', { error: res.message }), t('OK'));
					}
				} catch (error) {
					openPopUp(t('Error'), t('Failed to create alert. Please try again.'), t('OK'));
				}
			},
			true,
		);
	}, [inst, openPopUp, refetch, enableYes]);

	// URL-based alert selection
	useEffect(() => {
		if (!alertId || !alert_info || alert_info.alerts.length === 0) return;
		const index = alert_info.alerts.findIndex(attr => attr.id === alertId);
		if (index !== -1) {
			set_selected_rows([index]);
			set_selected_key(getHashKey(alert_info.alerts[index]).toString());
			set_cur_tab_idx(0);
		}
	}, [alertId, alert_info]);

	return alert_info && inst ? (
		<Fragment>
			{/* Filter Controls */}
			<Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
				<Stack spacing={2}>
					<Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
						<Stack direction="row" spacing={2} alignItems="center">
							<FormControl size="small" sx={{ minWidth: 120 }}>
								<InputLabel>{t('Status')}</InputLabel>
							<Select
								value={statusFilter}
								label={t('Status')}
								onChange={(e) => setStatusFilter(e.target.value)}
							>
								<MenuItem value="">{t('All')}</MenuItem>
								<MenuItem value="firing">{t('Active')}</MenuItem>
								<MenuItem value="resolved">{t('Resolved')}</MenuItem>
							</Select>
						</FormControl>

						<FormControl size="small" sx={{ minWidth: 120 }}>
							<InputLabel>{t('Severity')}</InputLabel>
							<Select
								value={severityFilter}
								label={t('Severity')}
								onChange={(e) => setSeverityFilter(e.target.value)}
							>
								<MenuItem value="">{t('All')}</MenuItem>
								<MenuItem value="critical">{t('Critical')}</MenuItem>
								<MenuItem value="warning">{t('Warning')}</MenuItem>
								<MenuItem value="info">{t('Info')}</MenuItem>
							</Select>
						</FormControl>

						<TextField
							size="small"
							label={t('Rule Name')}
							value={ruleNameFilter}
							onChange={(e) => setRuleNameFilter(e.target.value)}
							sx={{ minWidth: 200 }}
						/>

						<TextField
							size="small"
							label={t('Metric Name')}
							value={metricNameFilter}
							onChange={(e) => setMetricNameFilter(e.target.value)}
							sx={{ minWidth: 200 }}
						/>

						<Button variant="contained" onClick={applyFilters}>
							{t('Apply Filters')}
						</Button>

						{activeFilterCount > 0 && (
							<Button variant="outlined" onClick={clearFilters}>
								{t('Clear All')} ({activeFilterCount})
							</Button>
						)}
					</Stack>

					{/* Action Buttons */}
					<Button variant="contained" onClick={handleAdd}>
						{t('Create Manual Alert')}
					</Button>
				</Stack>

				{/* Active Filters Display */}
					{activeFilterCount > 0 && (
						<Stack direction="row" spacing={1} flexWrap="wrap">
							{statusFilter && (
								<Chip
									label={`${t('Status')}: ${statusFilter}`}
									onDelete={() => setStatusFilter('')}
									size="small"
								/>
							)}
							{severityFilter && (
								<Chip
									label={`${t('Severity')}: ${severityFilter}`}
									onDelete={() => setSeverityFilter('')}
									size="small"
								/>
							)}
							{ruleNameFilter && (
								<Chip
									label={`${t('Rule')}: ${ruleNameFilter}`}
									onDelete={() => setRuleNameFilter('')}
									size="small"
								/>
							)}
							{metricNameFilter && (
								<Chip
									label={`${t('Metric')}: ${metricNameFilter}`}
									onDelete={() => setMetricNameFilter('')}
									size="small"
								/>
							)}
						</Stack>
					)}
				</Stack>
			</Box>

			<AlertTable
				data={alert_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onResolve={handleResolve}
			/>

			{selected_alert && (
				<LowerSection>
					<Stack spacing={2}>
						<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />

						{cur_tab_idx === 0 && (
							<AlertSettingsPanel 
								alertRule={{
									id: selected_alert.rule_name || '',
									name: selected_alert.rule_name || '',
									metric_name: selected_alert.metric_name || '',
									enabled: true,
									severity: selected_alert.severity || 'info',
									message: selected_alert.message || '',
									condition: 'gt',
									threshold: 0,
									duration: 0,
									created_at: selected_alert.triggered_at || 0,
									updated_at: selected_alert.triggered_at || 0,
								}}
							/>
						)}
						{cur_tab_idx === 1 && (
							<AlertHistoryPanel 
								alertRule={{
									id: selected_alert.rule_name || '',
									name: selected_alert.rule_name || '',
									metric_name: selected_alert.metric_name || '',
									enabled: true,
									severity: selected_alert.severity || 'info',
									message: selected_alert.message || '',
									condition: 'gt',
									threshold: 0,
									duration: 0,
									created_at: selected_alert.triggered_at || 0,
									updated_at: selected_alert.resolved_at || selected_alert.triggered_at || 0,
								}}
							/>
						)}
						{cur_tab_idx === 2 && (
							<AlertActionsPanel 
								alertRule={{
									id: selected_alert.rule_name || '',
									name: selected_alert.rule_name || '',
									metric_name: selected_alert.metric_name || '',
									enabled: true,
									severity: selected_alert.severity || 'info',
									message: selected_alert.message || '',
									condition: 'gt',
									threshold: 0,
									duration: 0,
									created_at: selected_alert.triggered_at || 0,
									updated_at: selected_alert.triggered_at || 0,
								}}
							/>
						)}
					</Stack>
				</LowerSection>
			)}
		</Fragment>
	) : null;
}