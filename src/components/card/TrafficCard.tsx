//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {formatBytes} from 'common';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {t} from 'i18next';
import {ITimeSeriesPoint} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TrafficCard(props: {title: string; points: ITimeSeriesPoint<IProcessedTraffic>[]; data_key: string}) {
	const {title, points, data_key} = props;

	const traffic_data = {
		label: t('Traffic (bytes)'),
		values: points.map(point => {
			const key = data_key as keyof IProcessedTraffic;
			const value = point.data[key] ?? 0;

			return {
				timestamp: point.timestamp,
				data: value,
			};
		}),
	};

	// Calculate current total (latest value)
	const currentTotal = traffic_data.values[traffic_data.values.length - 1]?.data ?? 0;

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" gap={1}>
				{/* Current Total Display */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="caption" color="textSecondary">
						{t('Total Processed')}
					</Typography>
					<Typography variant="body2" fontWeight="bold" color="primary">
						{formatBytes(currentTotal)}
					</Typography>
				</Box>
				
				{/* Graph */}
				<SimpleLineGraph data={traffic_data} />
			</Box>
		</CardBase>
	);
}
