//---------------------------------------------------------
// Import statements and dependencies
//---------------------------------------------------------
import {Box, Typography, Chip, Grid, Collapse, Button} from '@mui/material';
import {ExpandLess, ExpandMore} from '@mui/icons-material';
import {detectRateUnit, formatRate, formatBytes} from 'common';
import MiniLineGraph from 'components/element/MiniLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {useLiveMetricsFullSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {useState} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LiveMetricsCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const [showAllCritical, setShowAllCritical] = useState(false);
	const [showAllImportant, setShowAllImportant] = useState(false);

	const liveMetrics = useLiveMetricsFullSeries(instance);

	// Extract specific metrics for display
	const responseTimeData = {
		label: t('Response Time (ms)'),
		values: liveMetrics.map(point => ({
			timestamp: point.timestamp,
			data: point.data.response_time_ms,
		})),
	};

	const totalMetricsData = {
		label: t('Total Metrics Count'),
		values: liveMetrics.map(point => ({
			timestamp: point.timestamp,
			data: point.data.total_metrics,
		})),
	};

	const latestMetrics = liveMetrics[liveMetrics.length - 1]?.data;

	// Display ALL critical and important metrics (no data loss)
	const allCriticalMetrics = latestMetrics?.critical ? Object.entries(latestMetrics.critical) : [];
	const allImportantMetrics = latestMetrics?.important ? Object.entries(latestMetrics.important) : [];
	
	// Show limited or all based on expand state
	const criticalMetrics = showAllCritical ? allCriticalMetrics : allCriticalMetrics.slice(0, 6);
	const importantMetrics = showAllImportant ? allImportantMetrics : allImportantMetrics.slice(0, 4);

	const formatMetricName = (name: string) => {
		return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	};

	// Helper function to create time series data for individual metrics
	const createMetricTimeSeries = (metricName: string) => {
		return {
			label: formatMetricName(metricName),
			values: liveMetrics.map(point => ({
				timestamp: point.timestamp,
				data: (point.data.critical?.[metricName] ?? point.data.important?.[metricName] ?? 0),
			})).filter(point => point.data !== 0), // Filter out missing values
		};
	};

	const formatMetricValue = (name: string, value: number) => {
		const unitType = detectRateUnit(name);
		
		switch (unitType) {
			case 'bps':
				return formatRate(value, 'bps');
			case 'pps':
				return formatRate(value, 'pps');
			case 'bytes':
				return formatBytes(value);
			default:
				// Generic number formatting
				if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
				if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
				return value.toFixed(2);
		}
	};

	return (
		<CardBase title={t('Live Metrics')}>
			<Box display="flex" flexDirection="column" gap={2}>
				{/* Status Indicators */}
				{/* <Box display="flex" gap={1} flexWrap="wrap">
					<Chip
						label={latestMetrics?.cache_enabled ? t('Cache Live') : t('Cache Down')}
						color={latestMetrics?.cache_enabled ? 'success' : 'error'}
						size="small"
					/>
					<Chip
						label={latestMetrics?.source === 'cache' ? t('Real-time') : t('Fallback')}
						color={latestMetrics?.source === 'cache' ? 'primary' : 'warning'}
						size="small"
					/>
					<Chip
						label={`${latestMetrics?.total_metrics ?? 0} ${t('Metrics')}`}
						color="info"
						size="small"
					/>
				</Box> */}

				{/* Performance Metrics */}
				{/* <Box display="flex" justifyContent="space-between">
					<Box>
						<Typography variant="caption" color="textSecondary">
							{t('Response Time')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{latestMetrics?.response_time_ms?.toFixed(2) ?? '0'} ms
						</Typography>
					</Box>
					<Box textAlign="right">
						<Typography variant="caption" color="textSecondary">
							{t('Total Metrics')}
						</Typography>
						<Typography variant="body2" fontWeight="bold">
							{latestMetrics?.total_metrics ?? 0}
						</Typography>
					</Box>
				</Box> */}

				{/* Critical Metrics Grid */}
				{allCriticalMetrics.length > 0 && (
					<Box>
						<Box display="flex" justifyContent="space-between" alignItems="center">
							<Typography variant="caption" color="textSecondary">
								{t('Critical Metrics')} ({allCriticalMetrics.length})
							</Typography>
							{allCriticalMetrics.length > 6 && (
								<Button
									size="small"
									onClick={() => setShowAllCritical(!showAllCritical)}
									startIcon={showAllCritical ? <ExpandLess /> : <ExpandMore />}
								>
									{showAllCritical ? t('Show Less') : t('Show All')}
								</Button>
							)}
						</Box>
						<Grid container spacing={1}>
							{criticalMetrics.map(([name, value], index) => (
								<Grid item xs={6} key={index}>
									<Box bgcolor="rgba(255, 152, 0, 0.1)" borderRadius={1}>
										<Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
											<Box flex={1}>
												<Typography variant="caption" color="textSecondary" noWrap>
													{formatMetricName(name)}
												</Typography>
												<Typography variant="body2" fontWeight="bold" noWrap>
													{formatMetricValue(name, value)}
												</Typography>
											</Box>
											<Box width={80} height={40}>
												<MiniLineGraph data={createMetricTimeSeries(name)} height={40} />
											</Box>
										</Box>
									</Box>
								</Grid>
							))}
						</Grid>
					</Box>
				)}

				{/* Important Metrics Grid */}
				{allImportantMetrics.length > 0 && (
					<Box>
						<Box display="flex" justifyContent="space-between" alignItems="center">
							<Typography variant="caption" color="textSecondary">
								{t('Important Metrics')} ({allImportantMetrics.length})
							</Typography>
							{allImportantMetrics.length > 4 && (
								<Button
									size="small"
									onClick={() => setShowAllImportant(!showAllImportant)}
									startIcon={showAllImportant ? <ExpandLess /> : <ExpandMore />}
								>
									{showAllImportant ? t('Show Less') : t('Show All')}
								</Button>
							)}
						</Box>
						<Grid container spacing={1}>
							{importantMetrics.map(([name, value], index) => (
								<Grid item xs={6} key={index}>
									<Box p={1} bgcolor="rgba(33, 150, 243, 0.1)" borderRadius={1}>
										<Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
											<Box flex={1}>
												<Typography variant="caption" color="textSecondary" noWrap>
													{formatMetricName(name)}
												</Typography>
												<Typography variant="body2" fontWeight="bold" noWrap>
													{formatMetricValue(name, value)}
												</Typography>
											</Box>
											<Box width={80} height={40}>
												<MiniLineGraph data={createMetricTimeSeries(name)} height={40} />
											</Box>
										</Box>
									</Box>
								</Grid>
							))}
						</Grid>
					</Box>
				)}

				{/* Response Time Trend */}
				<Box>
					<Typography variant="caption" color="textSecondary" gutterBottom>
						{t('Response Time Trend')}
					</Typography>
					<SimpleLineGraph data={responseTimeData} />
				</Box>
			</Box>
		</CardBase>
	);
}
