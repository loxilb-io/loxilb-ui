//---------------------------------------------------------
// Real-Time Rate Card with Moving Graph
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {formatRate} from 'common';
import RateLineGraph from 'components/element/RateLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import {useQuery} from '@tanstack/react-query';
import {query_get_live_metrics} from 'connector/instance/metrics';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import {ITimeSeriesPoint} from 'types/global';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
interface RealTimeRateCardProps {
	title: string;
	instance: IInstance | null;
	rateField: 'rps_bps' | 'rps_pps' | 'rps_tcp_bps' | 'rps_udp_bps' | 'rps_sctp_bps' | 'rps_tcp_pps' | 'rps_udp_pps' | 'rps_sctp_pps' | 'rps_eps';
	unit: 'bps' | 'pps' | 'eps' | 'fps';
	maxPoints?: number;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RealTimeRateCard(props: RealTimeRateCardProps) {
	const {title, instance, rateField, unit, maxPoints = 300} = props;

	// Get live metrics with 10-second polling
	const {data: rawLiveMetrics} = useQuery({
		queryKey: ['live-metrics-realtime', instance?.id],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, 2);
		},
		enabled: !!instance,
		refetchInterval: 1000, // 10-second polling
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;
	
	// State to accumulate time series data
	const [rateHistory, setRateHistory] = useState<ITimeSeriesPoint<number>[]>([]);

	// Update rate history when new metrics arrive
	useEffect(() => {
		if (!liveMetrics?.important) return;
		
		const rawRate = liveMetrics.important[rateField] || 0;
		// Convert bytes to bits if unit is bps (multiply by 8)
		const currentRate = unit === 'bps' ? rawRate * 8 : rawRate;
		const timestamp = Date.now();
		
		setRateHistory(prev => {
			// Add new data point
			const newHistory = [...prev, {
				timestamp,
				data: currentRate
			}];
			
			// Keep only the last N points for performance and moving window effect
			return newHistory.slice(-maxPoints);
		});
	}, [liveMetrics, rateField, maxPoints]);

	// Prepare data for the graph component
	const graphData = useMemo(() => ({
		label: unit === 'bps' ? t('Traffic (bps)') : t('Packets (pps)'),
		values: rateHistory
	}), [rateHistory, unit]);

	// Get current rate (last point)
	const currentRate = rateHistory[rateHistory.length - 1]?.data ?? 0;

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" gap={1}>
				{/* Current Rate Display */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="caption" color="textSecondary">
						{t('Current Rate')}
					</Typography>
					<RateTooltip rate={currentRate} unit={unit} title={title}>
						<Typography variant="body2" fontWeight="bold" color="primary" sx={{cursor: 'help'}}>
							{formatRate(currentRate, unit)}
						</Typography>
					</RateTooltip>
				</Box>
				
				{/* Real-time Moving Graph */}
				<RateLineGraph data={graphData} unit={unit} />
				
			</Box>
		</CardBase>
	);
}