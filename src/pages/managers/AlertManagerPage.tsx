//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Box, Typography} from '@mui/material';
import {getStableHash} from 'common';
import SubTabs from 'components/element/SubTabs';
import LowerSection from 'components/layout/LowerSection';
import AlertActionsPanel from 'components/panel/AlertActionsPanel';
import AlertConditionsPanel from 'components/panel/AlertConditionsPanel';
import AlertHistoryPanel from 'components/panel/AlertHistoryPanel';
import AlertSettingsPanel from 'components/panel/AlertSettingsPanel';
import AlertTestingPanel from 'components/panel/AlertTestingPanel';
import AlertRulesTable from 'components/table/managers/AlertRulesTable';
import {query_create_alert_rule, query_delete_alert_rule, query_update_alert_rule} from 'connector/instance/alerts';
import AlertRuleForm from 'components/input/AlertRuleForm';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useAlertRules} from 'hooks/query/alertHooks';
import {t} from 'i18next';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {IAlertRule, ICreateAlertRuleRequest, IUpdateAlertRuleRequest} from 'types/alerts';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AlertManagerPage() {
	const inst = useInstanceFromURL();

	const [searchParams] = useSearchParams();
	const ruleId = searchParams.get('ruleId');

	const {data: alert_data, refetch} = useAlertRules(inst);
	const alert_info = useMemo(() => ({rules: alert_data?.data ?? []}), [alert_data]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const [rule_name, set_rule_name] = useState<string | null>(null);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	const tabs: string[] = ['Settings', 'Conditions', 'Actions', 'History', 'Testing'];

	// Hash function for alert rule
	const getHashKey = (item: any) => {
		const str = `${item.id || ''}_${item.name || ''}_${item.metric_name || ''}`;
		return getStableHash(str);
	};

	// Sorted alert rules
	const sortedAttr = alert_info.rules ? [...alert_info.rules].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Find selected index in sortedAttr
	let selected_index = -1;
	if (selected_rows.length === 1 && alert_info.rules) {
		const original = alert_info.rules[selected_rows[0]];
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
	} else if (selected_key) {
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr).toString() === selected_key);
	}

	// Selection handler: map sorted index back to original
	const handleSelectionChange = (indices: number[]) => {
		if (indices.length === 1 && alert_info.rules) {
			const sortedItem = sortedAttr[indices[0]];
			const originalIndex = alert_info.rules.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
		} else {
			set_selected_rows([]);
		}
	};

	useEffect(() => {
		if (!alert_info || alert_info.rules.length === 0) return;
		if (selected_rows.length === 1) {
			const item = alert_info.rules[selected_rows[0]];
			set_selected_key(getHashKey(item).toString());
			set_rule_name(item.name);
			set_cur_tab_idx(0);
		} else if (selected_key !== null) {
			set_selected_key(null);
			set_rule_name(null);
			set_cur_tab_idx(0);
		}
	}, [alert_info, selected_rows, selected_key]);

	const {openPopUp, enableYes} = usePopUp();

	const handleDelete = useCallback(async () => {
		if (!inst || selected_rows.length !== 1) return;

		const rule_id = alert_info.rules[selected_rows[0]].id;

		const res = await query_delete_alert_rule(inst, rule_id);
		if (res.success) {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.message}), t('OK'));
	}, [inst, selected_rows, alert_info, openPopUp, refetch]);

	const instanceRef = useRef<ICreateAlertRuleRequest | null>(null);
	const handleAdd = useCallback(() => {
		if (!inst) return;

		const input_form = (
			<AlertRuleForm
				key={Date.now()}
				onChange={(data: { request: ICreateAlertRuleRequest | IUpdateAlertRuleRequest | null; isValid: boolean }) => {
					instanceRef.current = data.request as ICreateAlertRuleRequest;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Create'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				const res = await query_create_alert_rule(inst, instanceRef.current);
				if (res.success) {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.message}), t('OK'));
			},
			true,
		);
	}, [inst, openPopUp, refetch, enableYes]);

	// Update handler for alert rules
	const updateFormRef = useRef<IUpdateAlertRuleRequest | null>(null);
	const handleUpdate = useCallback(() => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedRule = alert_info.rules[selected_rows[0]];
		
		// Convert IAlertRule to format expected by AlertRuleForm
		const formData: Partial<ICreateAlertRuleRequest> = {
			name: selectedRule.name,
			metric_name: selectedRule.metric_name,
			condition: selectedRule.condition as 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte',
			threshold: selectedRule.threshold,
			duration: selectedRule.duration,
			severity: selectedRule.severity as 'critical' | 'warning' | 'info',
			message: selectedRule.message,
			enabled: selectedRule.enabled,
		};
		
		const update_form = (
			<AlertRuleForm
				key={Date.now()}
				initialData={formData}
				isEdit={true}
				onChange={(data: { request: IUpdateAlertRuleRequest | null; isValid: boolean }) => {
					updateFormRef.current = data.request;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			update_form,
			t('Update Alert Rule'),
			t('Cancel'),
			async () => {
				if (!updateFormRef.current) return;

				const res = await query_update_alert_rule(inst, selectedRule.id, updateFormRef.current);
				if (res.success) {
					openPopUp(t('Success'), t('Alert rule updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					openPopUp(t('Error'), t('Failed to update alert rule. {{error}}', {error: res.message}), t('OK'));
				}
			},
			true,
		);
	}, [inst, selected_rows, alert_info, openPopUp, refetch, enableYes]);

	// Test handler for alert rules
	const handleTest = useCallback(() => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedRule = alert_info.rules[selected_rows[0]];
		
		openPopUp(
			t('Test Alert Rule'),
			<Box sx={{ p: 2 }}>
				<Typography variant="body2">
					{t('Testing alert rule: {{ruleName}}', { ruleName: selectedRule.name })}
				</Typography>
				<Typography variant="body2" sx={{ mt: 1 }}>
					{t('This will trigger a test alert to verify the rule configuration.')}
				</Typography>
			</Box>,
			t('Run Test'),
			t('Cancel'),
			async () => {
				// Note: No test API endpoint in spec, placeholder implementation
				openPopUp(t('Info'), t('Alert rule testing functionality will be implemented when the API endpoint is available.'), t('OK'));
			},
			false,
		);
	}, [inst, selected_rows, alert_info, openPopUp]);

	// Toggle enabled handler for alert rules
	const handleToggleEnabled = useCallback(async () => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedRule = alert_info.rules[selected_rows[0]];
		const newEnabled = !selectedRule.enabled;

		const updateData: IUpdateAlertRuleRequest = {
			enabled: newEnabled
		};

		const res = await query_update_alert_rule(inst, selectedRule.id, updateData);
		if (res.success) {
			openPopUp(t('Success'), t('Alert rule {{action}} successfully.', { 
				action: newEnabled ? t('enabled') : t('disabled') 
			}), t('OK'));
			setTimeout(() => {
				refetch();
			}, 1000);
		} else {
			openPopUp(t('Error'), t('Failed to {{action}} alert rule. {{error}}', { 
				action: newEnabled ? t('enable') : t('disable'),
				error: res.message 
			}), t('OK'));
		}
	}, [inst, selected_rows, alert_info, openPopUp, refetch]);

	useEffect(() => {
		if (!ruleId || !alert_info || alert_info.rules.length === 0) return;
		const index = alert_info.rules.findIndex(attr => attr.id === ruleId);
		if (index !== -1) {
			set_selected_rows([index]);
			set_selected_key(getHashKey(alert_info.rules[index]).toString());
			set_rule_name(alert_info.rules[index].name);
			set_cur_tab_idx(0);
		}
	}, [ruleId, alert_info]);

	return alert_info && inst ? (
		<Fragment>
			<AlertRulesTable
				data={{rules: sortedAttr}}
				selected_rows={selected_index !== -1 ? [selected_index] : []}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onTest={handleTest}
				onToggleEnabled={handleToggleEnabled}
			/>

			{selected_index !== -1 && rule_name && (
				<LowerSection>
					<Stack spacing={2}>
						<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />
						{cur_tab_idx === 0 && <AlertSettingsPanel alertRule={	sortedAttr[selected_index]} />}
						{cur_tab_idx === 1 && <AlertConditionsPanel alertRule={sortedAttr[selected_index]} />}
						{cur_tab_idx === 2 && <AlertActionsPanel alertRule={sortedAttr[selected_index]} />}
						{cur_tab_idx === 3 && <AlertHistoryPanel alertRule={sortedAttr[selected_index]} />}
						{cur_tab_idx === 4 && <AlertTestingPanel alertRule={sortedAttr[selected_index]} />}
					</Stack>
				</LowerSection>
			)}
		</Fragment>
	) : null;
}