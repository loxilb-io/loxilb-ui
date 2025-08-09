//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {t} from 'i18next';
import {ITimelineDataSet} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PacketCard(props: {data_set: ITimelineDataSet<IProcessedTraffic>}) {
	const {data_set} = props;
	const {label, values} = data_set;

	const traffic_data = {
		label: t('Packets'),
		values: values.map(values => ({
			timestamp: values.timestamp,
			data: values.data.processed_sctp_bytes ?? 0,
		})),
	};

	// Format packet count for display
	const formatPacketCount = (count: number): string => {
		if (count >= 1e9) return `${(count / 1e9).toFixed(2)}B`;
		if (count >= 1e6) return `${(count / 1e6).toFixed(2)}M`;
		if (count >= 1e3) return `${(count / 1e3).toFixed(2)}K`;
		return count.toFixed(0);
	};

	// Calculate current total packets
	const currentTotal = traffic_data.values[traffic_data.values.length - 1]?.data ?? 0;

	return (
		<CardBase title={label ?? 'Packet Overview'}>
			<Box display="flex" flexDirection="column" gap={1}>
				{/* Current Total Display */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="caption" color="textSecondary">
						{t('Total Packets')}
					</Typography>
					<Typography variant="body2" fontWeight="bold" color="primary">
						{formatPacketCount(currentTotal)}
					</Typography>
				</Box>
				
				{/* Graph */}
				<SimpleLineGraph data={traffic_data} />
			</Box>
		</CardBase>
	);
}
