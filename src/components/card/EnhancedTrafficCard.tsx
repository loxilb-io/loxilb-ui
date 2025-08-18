//---------------------------------------------------------
// Import statements and dependencies
//---------------------------------------------------------
import {
	Box,
	Typography,
	Card,
	CardContent,
	Grid,
	Chip,
	Stack,
	LinearProgress,
	Tooltip,
	IconButton,
	useTheme,
	alpha
} from '@mui/material';
import {
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	Timeline as TimelineIcon
} from '@mui/icons-material';
import {
	LineChart,
	BarChart	
} from '@mui/x-charts';
import {formatBytes} from 'common';
import {t} from 'i18next';
import {useMemo, useState} from 'react';
import {ITimeSeriesPoint} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
const calculateTrend = (data: number[]): 'up' | 'down' | 'stable' => {
	if (data.length < 2) return 'stable';
	const recent = data.slice(-5); // Last 5 points
	const older = data.slice(-10, -5); // Previous 5 points
	
	const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
	const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
	
	const change = Math.abs(recentAvg - olderAvg) / olderAvg;
	
	if (change < 0.05) return 'stable'; // Less than 5% change
	return recentAvg > olderAvg ? 'up' : 'down';
};

const calculatePeakUsage = (data: number[]): {peak: number, peakTime: string, avg: number} => {
	if (data.length === 0) return {peak: 0, peakTime: 'N/A', avg: 0};
	
	const peak = Math.max(...data);
	const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
	
	// Simple peak time calculation (would be more sophisticated in real implementation)
	const peakIndex = data.indexOf(peak);
	const minutesAgo = data.length - peakIndex;
	const peakTime = minutesAgo === 1 ? 'Now' : `${minutesAgo}m ago`;
	
	return {peak, peakTime, avg};
};

//---------------------------------------------------------
// Custom Chart Components
//---------------------------------------------------------
interface ChartDataPoint {
	time: string;
	value: number;
	timestamp: number;
	rate?: number;
}

//---------------------------------------------------------
// Statistics Panel Component
//---------------------------------------------------------
interface StatsPanelProps {
	current: number;
	peak: number;
	average: number;
	trend: 'up' | 'down' | 'stable';
	dataKey: string;
}

function StatsPanel({current, peak, average, trend, dataKey}: StatsPanelProps) {
	const theme = useTheme();
	
	const getTrendIcon = () => {
		switch (trend) {
			case 'up': return <TrendingUpIcon color="success" />;
			case 'down': return <TrendingDownIcon color="error" />;
			case 'stable': return <TimelineIcon color="info" />;
		}
	};
	
	const getTrendColor = () => {
		switch (trend) {
			case 'up': return theme.palette.success.main;
			case 'down': return theme.palette.error.main;
			case 'stable': return theme.palette.info.main;
		}
	};

	return (
		<Grid container spacing={2} mb={2}>
			<Grid item xs={4}>
				<Card variant="outlined" sx={{ height: '100%', bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
					<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
						<Typography variant="caption" color="text.secondary" display="block">
							{t('Current')}
						</Typography>
						<Typography variant="h6" color="primary.main" fontWeight="bold">
							{formatBytes(current)}
						</Typography>
						<Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
							{getTrendIcon()}
							<Typography variant="caption" color={getTrendColor()}>
								{trend === 'stable' ? t('Stable') : trend === 'up' ? t('Increasing') : t('Decreasing')}
							</Typography>
						</Box>
					</CardContent>
				</Card>
			</Grid>
			
			<Grid item xs={4}>
				<Card variant="outlined" sx={{ height: '100%', bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
					<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
						<Typography variant="caption" color="text.secondary" display="block">
							{t('Peak (24h)')}
						</Typography>
						<Typography variant="h6" color="warning.main" fontWeight="bold">
							{formatBytes(peak)}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{peak > current ? `${((peak - current) / current * 100).toFixed(1)}% higher` : t('Current is peak')}
						</Typography>
					</CardContent>
				</Card>
			</Grid>
			
			<Grid item xs={4}>
				<Card variant="outlined" sx={{ height: '100%', bgcolor: alpha(theme.palette.info.main, 0.05) }}>
					<CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
						<Typography variant="caption" color="text.secondary" display="block">
							{t('Average')}
						</Typography>
						<Typography variant="h6" color="info.main" fontWeight="bold">
							{formatBytes(average)}
						</Typography>
						<LinearProgress 
							variant="determinate" 
							value={Math.min(100, (current / peak) * 100)} 
							color="info"
							sx={{ mt: 1, height: 6, borderRadius: 3 }}
						/>
					</CardContent>
				</Card>
			</Grid>
		</Grid>
	);
}

//---------------------------------------------------------
// Main Enhanced Traffic Card Component
//---------------------------------------------------------
interface EnhancedTrafficCardProps {
	title: string;
	points: ITimeSeriesPoint<IProcessedTraffic>[];
	data_key: string;
	showDetailedView?: boolean;
}

export default function EnhancedTrafficCard({title, points, data_key, showDetailedView = false}: EnhancedTrafficCardProps) {
	const theme = useTheme();
	const [viewMode, setViewMode] = useState<'area' | 'line' | 'bar'>('area');
	const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h');
	
	// Process data for charts
	const chartData = useMemo((): ChartDataPoint[] => {
		const maxPoints = timeRange === '15m' ? 15 : timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : 1440;
		const recentPoints = points.slice(-maxPoints);
		
		return recentPoints.map((point, index) => {
			const key = data_key as keyof IProcessedTraffic;
			const value = point.data[key] ?? 0;
			const prevValue = index > 0 ? (recentPoints[index - 1].data[key] ?? 0) : value;
			const rate = index > 0 ? Math.max(0, value - prevValue) : 0;
			
			return {
				time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
					hour12: false, 
					hour: '2-digit', 
					minute: '2-digit' 
				}),
				value,
				timestamp: point.timestamp,
				rate
			};
		});
	}, [points, data_key, timeRange]);

	const stats = useMemo(() => {
		const values = chartData.map(d => d.value);
		const rates = chartData.map(d => d.rate || 0);
		const trend = calculateTrend(values);
		const {peak, avg} = calculatePeakUsage(values);
		const current = values[values.length - 1] || 0;
		const currentRate = rates[rates.length - 1] || 0;
		
		return {current, peak, average: avg, trend, currentRate};
	}, [chartData]);

	// Custom gradient definitions
	const gradientId = `gradient-${data_key}`;
	const gradientColors = {
		processed_bytes: ['#00bcd4', '#006064'],
		processed_packets: ['#4caf50', '#1b5e20'],
		processed_tcp_bytes: ['#2196f3', '#0d47a1'],
		processed_udp_bytes: ['#ff9800', '#e65100'],
		processed_sctp_bytes: ['#9c27b0', '#4a148c']
	};
	
	const colors = gradientColors[data_key as keyof typeof gradientColors] || ['#00bcd4', '#006064'];

	const formatTooltip = (value: number | null, name: string | null) => {
		if (value === null) return '';
		if (name === 'value') return formatBytes(value);
		if (name === 'rate') return `${formatBytes(value)}/s`;
		return value.toString();
	};

	const renderChart = () => {
		const xData = chartData.map(d => d.time);
		const yData = chartData.map(d => d.value);
		const rateData = chartData.map(d => d.rate || 0);

		const commonProps = {
			width: 500,
			height: 200,
			margin: { top: 10, bottom: 30, left: 60, right: 30 },
		};

		switch (viewMode) {
			case 'area':
				return (
					<LineChart
						{...commonProps}
						series={[
							{
								data: yData,
								area: true,
								color: colors[0],
								curve: 'linear',
							}
						]}
						xAxis={[{
							data: xData,
							scaleType: 'point',
							tickLabelStyle: { fontSize: 10 }
						}]}
						yAxis={[{
							valueFormatter: (value: number) => formatBytes(value).split(' ')[0],
							tickLabelStyle: { fontSize: 10 }
						}]}
						grid={{ horizontal: true, vertical: true }}
						tooltip={{ trigger: 'axis' }}
					/>
				);
				
			case 'line':
				return (
					<LineChart
						{...commonProps}
						series={[
							{
								data: yData,
								color: colors[0],
								curve: 'linear',
								label: t('Total'),
							},
							{
								data: rateData,
								color: colors[1],
								curve: 'linear',
								label: t('Rate'),
							}
						]}
						xAxis={[{
							data: xData,
							scaleType: 'point',
							tickLabelStyle: { fontSize: 10 }
						}]}
						yAxis={[{
							valueFormatter: (value: number) => formatBytes(value).split(' ')[0],
							tickLabelStyle: { fontSize: 10 }
						}]}
						grid={{ horizontal: true, vertical: true }}
						tooltip={{ trigger: 'axis' }}
					/>
				);
				
			case 'bar':
				return (
					<BarChart
						{...commonProps}
						series={[
							{
								data: rateData,
								color: colors[0],
								label: t('Rate'),
							}
						]}
						xAxis={[{
							data: xData,
							scaleType: 'band',
							tickLabelStyle: { fontSize: 10 }
						}]}
						yAxis={[{
							valueFormatter: (value: number) => formatBytes(value).split(' ')[0],
							tickLabelStyle: { fontSize: 10 }
						}]}
						tooltip={{ trigger: 'axis' }}
					/>
				);
		}
	};

	return (
		<CardBase title={title}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Statistics Panel */}
				<StatsPanel
					current={stats.current}
					peak={stats.peak}
					average={stats.average}
					trend={stats.trend}
					dataKey={data_key}
				/>

				{/* Time Range Selector */}
				<Box mb={2}>
					<Stack direction="row" spacing={1}>
						{(['15m', '1h', '6h', '24h'] as const).map((range) => (
							<Chip
								key={range}
								label={range}
								size="small"
								clickable
								color={timeRange === range ? 'primary' : 'default'}
								variant={timeRange === range ? 'filled' : 'outlined'}
								onClick={() => setTimeRange(range)}
							/>
						))}
					</Stack>
				</Box>

				{/* Chart Area */}
				<Box flexGrow={1} minHeight={200} display="flex" justifyContent="center" alignItems="center">
					{renderChart()}
				</Box>

				{/* Performance Indicator */}
				<Box mt={2}>
					<Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
						<Typography variant="caption" color="text.secondary">
							{t('Performance vs Peak')}
						</Typography>
						<Typography variant="caption" color={stats.current > stats.average ? 'success.main' : 'warning.main'}>
							{stats.current > stats.average ? t('Above Average') : t('Below Average')}
						</Typography>
					</Box>
					<LinearProgress
						variant="determinate"
						value={Math.min(100, (stats.current / stats.peak) * 100)}
						color={stats.current > stats.average ? 'success' : 'warning'}
						sx={{ 
							height: 8, 
							borderRadius: 4,
							bgcolor: alpha(theme.palette.divider, 0.2),
							'& .MuiLinearProgress-bar': {
								borderRadius: 4,
								background: `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`
							}
						}}
					/>
				</Box>
			</Box>
		</CardBase>
	);
}