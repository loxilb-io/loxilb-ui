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
export default function AlertActionsPanel(props: {alertRule: IAlertRule}) {
	const {alertRule} = props;

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Alert Message')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Message')} value={alertRule.message} />
					<SingleTextBox label={t('Severity')} value={alertRule.severity} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Rule Status')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Enabled')} value={alertRule.enabled ? t('True') : t('False')} />
					<SingleTextBox label={t('Rule ID')} value={alertRule.id} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Alert Details')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Metric Name')} value={alertRule.metric_name} />
					<SingleTextBox label={t('Condition')} value={alertRule.condition} />
					<SingleTextBox label={t('Threshold')} value={alertRule.threshold.toString()} />
				</Grid2>
			</ValueBunch>
		</Stack>
	);
}
