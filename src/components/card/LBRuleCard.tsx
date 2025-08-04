//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {useLbRuleSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBRuleCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const lbRuleSeries = useLbRuleSeries(instance);

	const data_set = {
		label: t('LB Rule Count'),
		values: lbRuleSeries.map(point => ({
			timestamp: point.timestamp,
			data: point.data.lb_rule_count ?? 0,
		})),
	};

	return (
		<CardBase title={t('LB Rule Count Overview')}>
			<SimpleLineGraph data={data_set} />
		</CardBase>
	);
}
