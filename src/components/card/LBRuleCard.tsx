//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import RateLineGraph from 'components/element/RateLineGraph';
import {useLbRuleSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component - DeltaTrafficCard Style
//---------------------------------------------------------
export default function LBRuleCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const lbRuleSeries = useLbRuleSeries(instance);

	// Transform data to match RateLineGraph expectations
	const traffic_data = {
		label: t('LB Rule Count'),
		values: lbRuleSeries.map(point => ({
			timestamp: point.timestamp,
			data: point.data.lb_rule_count ?? 0,
		})),
	};

	// Get current value (latest rule count)
	const currentCount = lbRuleSeries[lbRuleSeries.length - 1]?.data.lb_rule_count ?? 0;

	return (
		<CardBase title={t('LB Rule Count')}>
			<Box display="flex" flexDirection="column" gap={1}>
				{/* Current Count Display - Same style as DeltaTrafficCard */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="caption" color="textSecondary">
						{t('Current Rules')}
					</Typography>
					<Typography variant="body2" fontWeight="bold" color="primary">
						{currentCount.toLocaleString()} {t('rules')}
					</Typography>
				</Box>
				
				{/* Graph - Using RateLineGraph with 'count' unit for proper formatting */}
				<RateLineGraph data={traffic_data} unit={'count'} />
			</Box>
		</CardBase>
	);
}