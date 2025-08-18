//---------------------------------------------------------
// Performance Charts Visualization Card
//---------------------------------------------------------
import {
	Box,
	Typography,
	Grid,
	Chip,
	Stack,
	Switch,
	FormControlLabel,
	Tooltip,
	IconButton,
	useTheme,
	alpha,
	Paper,
	CircularProgress,
	LinearProgress,
	Card,
	CardContent
} from '@mui/material';
import {
	Speed as SpeedIcon,
	Memory as MemoryIcon,
	Storage as StorageIcon,
	NetworkCheck as NetworkIcon,
	Refresh as RefreshIcon,
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	Timeline as TimelineIcon
} from '@mui/icons-material';
import {
	GaugeContainer,
	GaugeValueArc,
	GaugeReferenceArc,
	useGaugeState
} from '@mui/x-charts/Gauge';
import {formatBytes} from 'common';
import {t} from 'i18next';
import {useMemo, useState, useEffect} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Performance Metrics Interface
//---------------------------------------------------------
interface PerformanceMetric {
	id: string;
	label: string;
	value: number;
	max: number;
	unit: string;
	trend: 'up' | 'down' | 'stable';
	trendValue: string;
	status: 'good' | 'warning' | 'critical';
	icon: React.ReactNode;
}

//---------------------------------------------------------
// Mock Performance Data (In real app, this would come from APIs)
//---------------------------------------------------------
const generateMockPerformanceData = (): PerformanceMetric[] => {
	return [
		{
			id: 'cpu',
			label: t('CPU Usage'),
			value: 45 + Math.random() * 20,
			max: 100,
			unit: '%',
			trend: 'stable',
			trendValue: '+2.3%',
			status: 'good',
			icon: <SpeedIcon />
		},
		{
			id: 'memory',
			label: t('Memory Usage'),
			value: 68 + Math.random() * 15,
			max: 100,
			unit: '%',
			trend: 'up',
			trendValue: '+5.2%',
			status: 'warning',
			icon: <MemoryIcon />
		},
		{
			id: 'disk',
			label: t('Disk I/O'),
			value: 35 + Math.random() * 25,
			max: 100,
			unit: '%',
			trend: 'down',
			trendValue: '-1.8%',
			status: 'good',
			icon: <StorageIcon />
		},
		{
			id: 'network',
			label: t('Network Load'),
			value: 72 + Math.random() * 10,
			max: 100,
			unit: '%',
			trend: 'up',
			trendValue: '+8.1%',
			status: 'warning',
			icon: <NetworkIcon />
		}
	];
};

//---------------------------------------------------------
// Animated Gauge Component
//---------------------------------------------------------
interface AnimatedGaugeProps {
	metric: PerformanceMetric;
	size: number;
	showLabel?: boolean;
}

function AnimatedGauge({metric, size, showLabel = true}: AnimatedGaugeProps) {
	const theme = useTheme();
	const [currentValue, setCurrentValue] = useState(0);

	// Animate gauge value
	useEffect(() => {
		const timer = setTimeout(() => {
			setCurrentValue(metric.value);
		}, 100);
		return () => clearTimeout(timer);
	}, [metric.value]);

	const getStatusColor = () => {
		switch (metric.status) {
			case 'good': return theme.palette.success.main;
			case 'warning': return theme.palette.warning.main;
			case 'critical': return theme.palette.error.main;
			default: return theme.palette.primary.main;
		}
	};

	const getTrendIcon = () => {
		switch (metric.trend) {
			case 'up': return <TrendingUpIcon fontSize="small" color={metric.status === 'critical' ? 'error' : 'success'} />;
			case 'down': return <TrendingDownIcon fontSize="small" color="success" />;
			case 'stable': return <TimelineIcon fontSize="small" color="info" />;
		}
	};

	return (
		<Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			<CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1 }}>
				{/* Gauge Chart */}
				<Box position="relative" display="flex" justifyContent="center" alignItems="center">
					<GaugeContainer
						width={size}
						height={size}
						startAngle={-110}
						endAngle={110}
						value={currentValue}
						valueMax={metric.max}
					>
						<GaugeReferenceArc />
						<GaugeValueArc fill={getStatusColor()} />
					</GaugeContainer>
					
					{/* Center Value */}
					<Box 
						position="absolute" 
						display="flex" 
						flexDirection="column" 
						alignItems="center"
						top="50%"
						left="50%"
						sx={{ transform: 'translate(-50%, -30%)' }}
					>
						<Typography variant="h6" fontWeight="bold" color={getStatusColor()}>
							{currentValue.toFixed(1)}{metric.unit}
						</Typography>
						<Box display="flex" alignItems="center" gap={0.5}>
							{getTrendIcon()}
							<Typography variant="caption" color="text.secondary">
								{metric.trendValue}
							</Typography>
						</Box>
					</Box>
				</Box>

				{/* Label and Status */}
				{showLabel && (
					<Box mt={1} textAlign="center" width="100%">
						<Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mb={1}>
							{metric.icon}
							<Typography variant="body2" fontWeight="medium">
								{metric.label}
							</Typography>
						</Stack>
						<Chip 
							label={metric.status.toUpperCase()} 
							size="small" 
							color={
								metric.status === 'good' ? 'success' : 
								metric.status === 'warning' ? 'warning' : 'error'
							}
							variant="outlined"
						/>
					</Box>
				)}
			</CardContent>
		</Card>
	);
}

//---------------------------------------------------------
// Performance Summary Component
//---------------------------------------------------------
interface PerformanceSummaryProps {
	metrics: PerformanceMetric[];
}

function PerformanceSummary({metrics}: PerformanceSummaryProps) {
	const theme = useTheme();

	const overallScore = useMemo(() => {
		const avgValue = metrics.reduce((sum, metric) => sum + (metric.value / metric.max), 0) / metrics.length;
		return Math.round((1 - avgValue) * 100); // Invert for health score
	}, [metrics]);

	const getScoreColor = (score: number) => {
		if (score >= 80) return theme.palette.success.main;
		if (score >= 60) return theme.palette.warning.main;
		return theme.palette.error.main;
	};

	const criticalCount = metrics.filter(m => m.status === 'critical').length;
	const warningCount = metrics.filter(m => m.status === 'warning').length;
	const goodCount = metrics.filter(m => m.status === 'good').length;

	return (
		<Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
			<Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
				<SpeedIcon color="primary" />
				{t('Performance Overview')}
			</Typography>

			{/* Overall Score */}
			<Box display="flex" alignItems="center" gap={2} mb={2}>
				<Box position="relative" display="inline-flex">
					<CircularProgress
						variant="determinate"
						value={overallScore}
						size={80}
						thickness={4}
						sx={{ color: getScoreColor(overallScore) }}
					/>
					<Box
						position="absolute"
						top={0}
						left={0}
						bottom={0}
						right={0}
						display="flex"
						alignItems="center"
						justifyContent="center"
					>
						<Typography variant="h6" color={getScoreColor(overallScore)} fontWeight="bold">
							{overallScore}
						</Typography>
					</Box>
				</Box>
				<Box>
					<Typography variant="h6" color={getScoreColor(overallScore)}>
						{t('Health Score')}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						{overallScore >= 80 ? t('Excellent') : overallScore >= 60 ? t('Good') : t('Needs Attention')}
					</Typography>
				</Box>
			</Box>

			{/* Status Summary */}
			<Grid container spacing={1}>
				<Grid item xs={4}>
					<Box textAlign="center" p={1}>
						<Typography variant="h6" color="success.main">{goodCount}</Typography>
						<Typography variant="caption" color="text.secondary">{t('Good')}</Typography>
					</Box>
				</Grid>
				<Grid item xs={4}>
					<Box textAlign="center" p={1}>
						<Typography variant="h6" color="warning.main">{warningCount}</Typography>
						<Typography variant="caption" color="text.secondary">{t('Warning')}</Typography>
					</Box>
				</Grid>
				<Grid item xs={4}>
					<Box textAlign="center" p={1}>
						<Typography variant="h6" color="error.main">{criticalCount}</Typography>
						<Typography variant="caption" color="text.secondary">{t('Critical')}</Typography>
					</Box>
				</Grid>
			</Grid>

			{/* Performance Bars */}
			<Box mt={2}>
				<Typography variant="body2" color="text.secondary" mb={1}>
					{t('Resource Utilization')}
				</Typography>
				{metrics.map((metric) => (
					<Box key={metric.id} mb={1}>
						<Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
							<Typography variant="caption" color="text.secondary">
								{metric.label}
							</Typography>
							<Typography variant="caption" fontWeight="bold">
								{metric.value.toFixed(1)}{metric.unit}
							</Typography>
						</Box>
						<LinearProgress
							variant="determinate"
							value={(metric.value / metric.max) * 100}
							color={
								metric.status === 'good' ? 'success' : 
								metric.status === 'warning' ? 'warning' : 'error'
							}
							sx={{ height: 6, borderRadius: 3 }}
						/>
					</Box>
				))}
			</Box>
		</Paper>
	);
}

//---------------------------------------------------------
// Main Performance Charts Card
//---------------------------------------------------------
export default function PerformanceChartsCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const [realTime, setRealTime] = useState(true);
	const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);

	// Generate performance data and update periodically if real-time is enabled
	useEffect(() => {
		const updateData = () => {
			setPerformanceData(generateMockPerformanceData());
		};

		updateData();
		
		if (realTime) {
			const interval = setInterval(updateData, 3000); // Update every 3 seconds
			return () => clearInterval(interval);
		}
	}, [realTime]);

	return (
		<CardBase title={t('Performance Metrics')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Controls */}
				<Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
					<FormControlLabel
						control={
							<Switch 
								checked={realTime} 
								onChange={(e) => setRealTime(e.target.checked)} 
							/>
						}
						label={<Typography variant="body2">{t('Real-time Updates')}</Typography>}
					/>
					<Tooltip title={t('Refresh Data')}>
						<IconButton 
							size="small" 
							onClick={() => setPerformanceData(generateMockPerformanceData())}
						>
							<RefreshIcon />
						</IconButton>
					</Tooltip>
				</Box>

				{/* Performance Gauges and Summary */}
				<Grid container spacing={2} flexGrow={1}>
					{/* Performance Summary */}
					<Grid item xs={4}>
						<PerformanceSummary metrics={performanceData} />
					</Grid>

					{/* Performance Gauges */}
					<Grid item xs={8}>
						<Grid container spacing={2} height="100%">
							{performanceData.map((metric) => (
								<Grid item xs={6} key={metric.id}>
									<AnimatedGauge 
										metric={metric} 
										size={120}
										showLabel={true}
									/>
								</Grid>
							))}
						</Grid>
					</Grid>
				</Grid>
			</Box>
		</CardBase>
	);
}