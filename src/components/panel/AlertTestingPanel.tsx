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
export default function AlertTestingPanel(props: {alertRule: IAlertRule}) {
	const {alertRule} = props;

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Rule Testing Information')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Rule Name')} value={alertRule.name} />
					<SingleTextBox label={t('Metric Name')} value={alertRule.metric_name} />
					<SingleTextBox label={t('Current Status')} value={alertRule.enabled ? t('Enabled') : t('Disabled')} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Threshold Testing')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Threshold Value')} value={alertRule.threshold.toString()} />
					<SingleTextBox label={t('Condition')} value={alertRule.condition} />
					<SingleTextBox label={t('Duration')} value={alertRule.duration.toString() + 's'} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Alert Configuration')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Severity')} value={alertRule.severity} />
					<SingleTextBox label={t('Message')} value={alertRule.message} />
					<SingleTextBox label={t('Rule ID')} value={alertRule.id} />
				</Grid2>
			</ValueBunch>
		</Stack>
	);
}
