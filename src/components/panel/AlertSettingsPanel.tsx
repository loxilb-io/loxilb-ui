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

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Alert Rule Identity')}>
			<Grid2 container spacing={2}>
				<SingleTextBox label={t('Name')} value={alertRule.name} />
				<SingleTextBox label={t('ID')} value={alertRule.id} />
				<SingleTextBox label={t('Metric Name')} value={alertRule.metric_name} />
				<SingleTextBox label={t('Enabled')} value={alertRule.enabled ? t('True') : t('False')} />
			</Grid2>
		</ValueBunch>

		<ValueBunch name={t('Threshold Configuration')}>
			<Grid2 container spacing={2}>
				<SingleTextBox label={t('Threshold')} value={alertRule.threshold.toString()} />
				<SingleTextBox label={t('Condition')} value={alertRule.condition} />
				<SingleTextBox label={t('Duration')} value={alertRule.duration.toString() + 's'} />
			</Grid2>
		</ValueBunch>

		<ValueBunch name={t('Alert Configuration')}>
			<Grid2 container spacing={2}>
				<SingleTextBox label={t('Severity')} value={alertRule.severity} />
				<SingleTextBox label={t('Message')} value={alertRule.message} />
				<SingleTextBox label={t('Created At')} value={new Date(alertRule.created_at * 1000).toLocaleString()} />
			</Grid2>
		</ValueBunch>
		</Stack>
	);
}
