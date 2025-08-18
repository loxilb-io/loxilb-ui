//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {formatRate} from 'common';
import RateLineGraph from 'components/element/RateLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import {t} from 'i18next';
import {useMemo} from 'react';
import {ITimeSeriesPoint} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
const calculateDeltaRate = (points: ITimeSeriesPoint<IProcessedTraffic>[], dataKey: keyof IProcessedTraffic) => {
	if (points.length < 2) {
		console.log(`[calculateDeltaRate] Not enough points: ${points.length}`);
		return [];
	}

	return points.slice(1).map((point, index) => {
		const prevPoint = points[index]; // index is already offset by slice(1)
		const deltaValue = (point.data[dataKey] ?? 0) - (prevPoint.data[dataKey] ?? 0);
		const deltaTime = (point.timestamp - prevPoint.timestamp) / 1000; // Convert ms to seconds
		const rate = deltaTime > 0 ? deltaValue / deltaTime : 0;

		return {
			timestamp: point.timestamp,
			data: Math.max(rate, 0), // Ensure non-negative values
		};
	});
};

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeltaTrafficCard(props: {
	title: string;
	points: ITimeSeriesPoint<IProcessedTraffic>[];
	data_key: keyof IProcessedTraffic;
	unit?: 'bps' | 'pps';
}) {
	const {title, points, data_key, unit = 'bps'} = props;

	// Calculate delta rates from cumulative values
	const deltaRates = useMemo(() => {		
		// Limit to last 60 points for better performance and visualization
		const recentPoints = points.slice(-60);
		const result = calculateDeltaRate(recentPoints, data_key);
		
		return result;
	}, [points, data_key]);

	const traffic_data = {
		label: unit === 'bps' ? t('Traffic (bps)') : t('Packets (pps)'),
		values: deltaRates,
	};

	// Calculate current rate (last delta)
	const currentRate = deltaRates[deltaRates.length - 1]?.data ?? 0;

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
				
				{/* Graph */}
				<RateLineGraph data={traffic_data} unit={unit} />
			</Box>
		</CardBase>
	);
}
