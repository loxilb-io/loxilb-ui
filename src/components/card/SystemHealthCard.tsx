//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography, Chip, LinearProgress} from '@mui/material';
import {formatBytes} from 'common';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {useSystemHealthSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemHealthCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const healthSeries = useSystemHealthSeries(instance);

	const utilizationData = {
		label: t('System Utilization (%)'),
		values: healthSeries.map(point => ({
			timestamp: point.timestamp,
			data: point.data.average_utilization * 100,
		})),
	};

	const latestHealth = healthSeries[healthSeries.length - 1]?.data;

	const getStatusColor = (status?: string) => {
		switch (status) {
			case 'healthy':
				return 'success';
			case 'degraded':
				return 'warning';
			case 'unhealthy':
				return 'error';
			default:
				return 'default';
		}
	};

	const getUtilizationColor = (utilization: number) => {
		if (utilization < 60) return 'success';
		if (utilization < 80) return 'warning';
		return 'error';
	};

	return (
		<CardBase title={t('System Health')}>
			<Box display="flex" flexDirection="column" gap={2}>
				{/* Status Overview */}
				<Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
					<Chip
						label={latestHealth?.status ? t(latestHealth.status) : t('Unknown')}
						color={getStatusColor(latestHealth?.status)}
						size="small"
					/>
					<Chip
						label={latestHealth?.cache_enabled ? t('Cache OK') : t('Cache Down')}
						color={latestHealth?.cache_enabled ? 'success' : 'error'}
						size="small"
					/>
				</Box>

				{/* Metrics */}
				<Box display="flex" justifyContent="space-between">
					<Box flex={1}>
						<Typography variant="caption" color="textSecondary">
							{t('Memory Usage')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{latestHealth?.memory_usage_mb ? `${latestHealth.memory_usage_mb.toFixed(1)} MB` : '0 MB'}
						</Typography>
					</Box>
					<Box flex={1} textAlign="center">
						<Typography variant="caption" color="textSecondary">
							{t('Buffers')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{latestHealth?.total_buffers ?? 0}
						</Typography>
					</Box>
					<Box flex={1} textAlign="right">
						<Typography variant="caption" color="textSecondary">
							{t('Utilization')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{((latestHealth?.average_utilization ?? 0) * 100).toFixed(1)}%
						</Typography>
					</Box>
				</Box>

				{/* Utilization Progress Bar */}
				<Box>
					<Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
						<Typography variant="caption" color="textSecondary">
							{t('System Load')}
						</Typography>
						<Typography variant="caption" color="textSecondary">
							{((latestHealth?.average_utilization ?? 0) * 100).toFixed(1)}%
						</Typography>
					</Box>
					<LinearProgress
						variant="determinate"
						value={(latestHealth?.average_utilization ?? 0) * 100}
						color={getUtilizationColor((latestHealth?.average_utilization ?? 0) * 100)}
						sx={{height: 8, borderRadius: 4}}
					/>
				</Box>

				{/* Utilization Trend Graph */}
				<Box>
					<Typography variant="caption" color="textSecondary" gutterBottom>
						{t('System Utilization Trend')}
					</Typography>
					<SimpleLineGraph data={utilizationData} />
				</Box>
			</Box>
		</CardBase>
	);
}
