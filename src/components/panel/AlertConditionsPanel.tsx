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
export default function AlertConditionsPanel(props: {alertRule: IAlertRule}) {
	const {alertRule} = props;

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Condition Details')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Metric Name')} value={alertRule.metric_name} />
					<SingleTextBox label={t('Threshold')} value={alertRule.threshold.toString()} />
					<SingleTextBox label={t('Condition')} value={alertRule.condition} />
					<SingleTextBox label={t('Duration')} value={alertRule.duration.toString() + 's'} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Rule Configuration')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Severity')} value={alertRule.severity} />
					<SingleTextBox label={t('Enabled')} value={alertRule.enabled ? t('True') : t('False')} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Timestamps')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Created At')} value={new Date(alertRule.created_at * 1000).toLocaleString()} />
					<SingleTextBox label={t('Updated At')} value={new Date(alertRule.updated_at * 1000).toLocaleString()} />
				</Grid2>
			</ValueBunch>
		</Stack>
	);
}
