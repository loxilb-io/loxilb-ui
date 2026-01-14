//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {t} from 'i18next';
import {IAlertRule} from 'types/alerts';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AlertSettingsPanel(props: {alertRule: IAlertRule}) {
	const {alertRule} = props;

	// Handle both API response formats: some fields may be named differently
	// API returns: rule_name for display name, rule_id or id for actual ID
	const displayName = (alertRule as any).rule_name || alertRule.name || 'N/A';
	const displayId = (alertRule as any).rule_id || alertRule.id || 'N/A';

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Alert Rule Identity')}>
			<Grid2 container spacing={2}>
				<SingleTextBox label={t('Name')} value={displayName} />
				<Grid2 size={6}>
					<SingleTextBox label={t('Raw_ID')} value={displayId} />
				</Grid2>
				<SingleTextBox label={t('Metric Name')} value={alertRule.metric_name} />
				<SingleTextBox label={t('Enabled')} value={alertRule.enabled ? t('True') : t('False')} />
			</Grid2>
		</ValueBunch>

		<ValueBunch name={t('Threshold Configuration')}>
			<Grid2 container spacing={2}>
				<SingleTextBox label={t('Threshold')} value={alertRule.threshold.toString()} />
				<SingleTextBox label={t('Condition')} value={alertRule.condition} />
				<SingleTextBox label={t('Duration')} value={alertRule.duration.toString() + 's'} />
				{alertRule.value !== undefined && <SingleTextBox label={t('Current Value')} value={alertRule.value.toString()} />}
			</Grid2>
		</ValueBunch>

		<ValueBunch name={t('Alert Configuration')}>
			<Grid2 container spacing={2}>
				<SingleTextBox label={t('Severity')} value={alertRule.severity} />
				<SingleTextBox label={t('Message')} value={alertRule.message} />
				<SingleTextBox label={t('Created At')} value={new Date(alertRule.created_at * 1000).toLocaleString()} />
				{alertRule.status && <SingleTextBox label={t('Status')} value={alertRule.status} />}
			</Grid2>
		</ValueBunch>

		{(alertRule.triggered_at || alertRule.first_breach || alertRule.last_seen) && (
			<ValueBunch name={t('Alert Status')}>
				<Grid2 container spacing={2}>
					{alertRule.triggered_at && <SingleTextBox label={t('Triggered At')} value={new Date(alertRule.triggered_at * 1000).toLocaleString()} />}
					{alertRule.first_breach && <SingleTextBox label={t('First Breach')} value={new Date(alertRule.first_breach * 1000).toLocaleString()} />}
					{alertRule.last_seen && <SingleTextBox label={t('Last Seen')} value={new Date(alertRule.last_seen * 1000).toLocaleString()} />}
				</Grid2>
			</ValueBunch>
		)}
		</Stack>
	);
}
