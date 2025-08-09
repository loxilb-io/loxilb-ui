//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography, Chip} from '@mui/material';
import {formatBytes} from 'common';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {useCacheStatsSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function CacheStatsCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const cacheStats = useCacheStatsSeries(instance);

	const utilizationData = {
		label: t('Cache Utilization (%)'),
		values: cacheStats.map(point => ({
			timestamp: point.timestamp,
			data: point.data.average_utilization * 100,
		})),
	};

	const memoryData = {
		label: t('Memory Usage (MB)'),
		values: cacheStats.map(point => ({
			timestamp: point.timestamp,
			data: point.data.memory_usage_mb,
		})),
	};

	const latestStats = cacheStats[cacheStats.length - 1]?.data;

	return (
		<CardBase title={t('Cache Statistics')}>
			<Box display="flex" flexDirection="column" gap={2}>
				{/* Status Chips */}
				<Box display="flex" gap={1} flexWrap="wrap">
					<Chip
						label={latestStats?.enabled ? t('Cache Enabled') : t('Cache Disabled')}
						color={latestStats?.enabled ? 'success' : 'error'}
						size="small"
					/>
					<Chip
						label={`${latestStats?.total_buffers ?? 0} ${t('Buffers')}`}
						color="info"
						size="small"
					/>
					<Chip
						label={`${latestStats?.phase1_metrics_count ?? 0} ${t('Critical')}`}
						color="warning"
						size="small"
					/>
					<Chip
						label={`${latestStats?.phase2_metrics_count ?? 0} ${t('Important')}`}
						color="primary"
						size="small"
					/>
				</Box>

				{/* Current Stats */}
				<Box display="flex" justifyContent="space-between">
					<Box>
						<Typography variant="caption" color="textSecondary">
							{t('Memory Usage')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{formatBytes(latestStats?.total_memory_bytes ?? 0)}
						</Typography>
					</Box>
					<Box textAlign="right">
						<Typography variant="caption" color="textSecondary">
							{t('Utilization')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{((latestStats?.average_utilization ?? 0) * 100).toFixed(1)}%
						</Typography>
					</Box>
				</Box>

				{/* Utilization Graph */}
				<Box>
					<Typography variant="caption" color="textSecondary" gutterBottom>
						{t('Cache Utilization Trend')}
					</Typography>
					<SimpleLineGraph data={utilizationData} />
				</Box>
			</Box>
		</CardBase>
	);
}
