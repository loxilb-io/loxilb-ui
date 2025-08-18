//---------------------------------------------------------
// Import statements and dependencies  
//---------------------------------------------------------
import {
	Box,
	Typography,
	Grid,
	Card,
	CardContent,
	Chip,
	LinearProgress,
	Stack,
	Divider,
	Alert,
	CircularProgress
} from '@mui/material';
import {
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	TrendingFlat as TrendingFlatIcon,
	Assessment as AssessmentIcon,
	Schedule as ScheduleIcon,
	CheckCircle as CheckCircleIcon,
	Error as ErrorIcon
} from '@mui/icons-material';
import {useAllAlertsMain} from 'hooks/query/alertHooks';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import {IAlert} from 'types/alerts';
import CardBase from './CardBase';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
const calculateTrend = (current: number, previous: number): 'up' | 'down' | 'flat' => {
	if (current > previous) return 'up';
	if (current < previous) return 'down';
	return 'flat';
};

const getTrendIcon = (trend: 'up' | 'down' | 'flat') => {
	switch (trend) {
		case 'up': return <TrendingUpIcon color="error" />;
		case 'down': return <TrendingDownIcon color="success" />;
		case 'flat': return <TrendingFlatIcon color="info" />;
	}
};

const getTrendColor = (trend: 'up' | 'down' | 'flat', isPositive: boolean = false): 'success' | 'error' | 'info' => {
	if (trend === 'flat') return 'info';
	if (isPositive) {
		return trend === 'up' ? 'success' : 'error';
	}
	return trend === 'up' ? 'error' : 'success';
};

//---------------------------------------------------------
// Summary Metric Component
//---------------------------------------------------------
interface SummaryMetricProps {
	title: string;
	value: number | string;
	subtitle?: string;
	trend?: 'up' | 'down' | 'flat';
	trendValue?: string;
	color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
	icon?: React.ReactNode;
}

function SummaryMetric({title, value, subtitle, trend, trendValue, color = 'primary', icon}: SummaryMetricProps) {
	return (
		<Card variant="outlined" sx={{ height: '100%' }}>
			<CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
				<Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
					<Box display="flex" alignItems="center" gap={1}>
						{icon}
						<Typography variant="body2" color="text.secondary">
							{title}
						</Typography>
					</Box>
					{trend && (
						<Box display="flex" alignItems="center" gap={0.5}>
							{getTrendIcon(trend)}
							{trendValue && (
								<Typography variant="caption" color={getTrendColor(trend)}>
									{trendValue}
								</Typography>
							)}
						</Box>
					)}
				</Box>
				
				<Typography variant="h5" color={`${color}.main`} fontWeight="bold">
					{value}
				</Typography>
				
				{subtitle && (
					<Typography variant="caption" color="text.secondary">
						{subtitle}
					</Typography>
				)}
			</CardContent>
		</Card>
	);
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AlertSummaryCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const {data: allAlertsResponse, isLoading: alertsLoading, error: alertsError} = useAllAlertsMain(instance);

	const allAlerts = allAlertsResponse?.data || [];

	// Calculate additional metrics from alerts data
	const metrics = useMemo(() => {
		if (!allAlerts.length) {
			return {
				resolvedToday: 0,
				avgResolutionTime: 0,
				criticalCount: 0,
				warningCount: 0,
				infoCount: 0,
				resolutionRate: 100
			};
		}

		const now = Date.now();
		const oneDayAgo = now - (24 * 60 * 60 * 1000);

		const resolvedToday = allAlerts.filter(alert => 
			alert.status === 'resolved' && 
			alert.resolved_at && 
			(alert.resolved_at * 1000) > oneDayAgo
		).length;

		const resolvedAlerts = allAlerts.filter(alert => 
			alert.status === 'resolved' && 
			alert.resolved_at && 
			alert.triggered_at
		);

		const avgResolutionTime = resolvedAlerts.length > 0
			? resolvedAlerts.reduce((sum, alert) => 
				sum + (alert.resolved_at! - alert.triggered_at), 0) / resolvedAlerts.length / 60 // Convert to minutes
			: 0;

		// Filter for firing/active alerts (same as ActiveAlertsCard)
		const activeAlerts = allAlerts.filter(alert => alert.status === 'firing');
		const criticalCount = activeAlerts.filter(alert => alert.severity.toLowerCase() === 'critical').length;
		const warningCount = activeAlerts.filter(alert => alert.severity.toLowerCase() === 'warning').length;
		const infoCount = activeAlerts.filter(alert => alert.severity.toLowerCase() === 'info').length;

		const resolutionRate = allAlerts.length > 0 
			? (resolvedAlerts.length / allAlerts.length) * 100 
			: 100;

		return {
			resolvedToday,
			avgResolutionTime: Math.round(avgResolutionTime),
			criticalCount,
			warningCount,
			infoCount,
			resolutionRate: Math.round(resolutionRate)
		};
	}, [allAlerts]);

	const isLoading = alertsLoading;
	const error = alertsError;

	// Loading state
	if (isLoading) {
		return (
			<CardBase title={t('Alert Summary')}>
				<Box display="flex" justifyContent="center" alignItems="center" height="100%">
					<CircularProgress />
				</Box>
			</CardBase>
		);
	}

	// Error state
	if (error) {
		return (
			<CardBase title={t('Alert Summary')}>
				<Alert severity="error">
					{t('Failed to load alert statistics')}
				</Alert>
			</CardBase>
		);
	}

	const systemHealth = metrics.criticalCount === 0 && metrics.warningCount === 0 ? 100 : 
		Math.max(0, 100 - (metrics.criticalCount * 30 + metrics.warningCount * 10));

	return (
		<CardBase title={t('Alert Summary')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Header */}
				<Box display="flex" alignItems="center" gap={1} mb={2}>
					<AssessmentIcon color="primary" />
					<Typography variant="h6" fontWeight="bold">
						{t('System Analytics')}
					</Typography>
				</Box>

				{/* System Health Score */}
				<Box mb={3}>
					<Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
						<Typography variant="body2" color="text.secondary">
							{t('System Health Score')}
						</Typography>
						<Typography variant="h6" color={systemHealth >= 90 ? 'success.main' : systemHealth >= 70 ? 'warning.main' : 'error.main'}>
							{systemHealth}%
						</Typography>
					</Box>
					<LinearProgress 
						variant="determinate" 
						value={systemHealth} 
						color={systemHealth >= 90 ? 'success' : systemHealth >= 70 ? 'warning' : 'error'}
						sx={{ height: 8, borderRadius: 4 }}
					/>
					<Typography variant="caption" color="text.secondary" mt={0.5} display="block">
						{systemHealth >= 90 ? t('Excellent') : systemHealth >= 70 ? t('Good') : systemHealth >= 50 ? t('Fair') : t('Needs Attention')}
					</Typography>
				</Box>

				<Divider sx={{ mb: 2 }} />

				{/* Key Metrics Grid */}
				<Grid container spacing={2} mb={2}>
					<Grid item xs={6}>
						<SummaryMetric
							title={t('Total Active')}
							value={metrics.criticalCount + metrics.warningCount + metrics.infoCount}
							subtitle={t('Current alerts')}
							color={metrics.criticalCount > 0 ? 'error' : metrics.warningCount > 0 ? 'warning' : 'success'}
							icon={<ErrorIcon />}
						/>
					</Grid>
					<Grid item xs={6}>
						<SummaryMetric
							title={t('Resolved Today')}
							value={metrics.resolvedToday}
							subtitle={t('Last 24 hours')}
							color="success"
							icon={<CheckCircleIcon />}
						/>
					</Grid>
				</Grid>

				<Grid container spacing={2} mb={2}>
					<Grid item xs={6}>
						<SummaryMetric
							title={t('Avg Resolution')}
							value={`${metrics.avgResolutionTime}m`}
							subtitle={t('Minutes to resolve')}
							color="info"
							icon={<ScheduleIcon />}
						/>
					</Grid>
					<Grid item xs={6}>
						<SummaryMetric
							title={t('Resolution Rate')}
							value={`${metrics.resolutionRate}%`}
							subtitle={t('Overall success rate')}
							color={metrics.resolutionRate >= 95 ? 'success' : metrics.resolutionRate >= 80 ? 'warning' : 'error'}
						/>
					</Grid>
				</Grid>

				{/* Alert Breakdown */}
				<Box>
					<Typography variant="body2" color="text.secondary" mb={1}>
						{t('Active Alerts by Severity')}
					</Typography>
					<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
						<Chip
							label={t('Critical: {{count}}', {count: metrics.criticalCount})}
							color="error"
							variant={metrics.criticalCount > 0 ? 'filled' : 'outlined'}
							size="small"
						/>
						<Chip
							label={t('Warning: {{count}}', {count: metrics.warningCount})}
							color="warning"
							variant={metrics.warningCount > 0 ? 'filled' : 'outlined'}
							size="small"
						/>
						<Chip
							label={t('Info: {{count}}', {count: metrics.infoCount})}
							color="info"
							variant={metrics.infoCount > 0 ? 'filled' : 'outlined'}
							size="small"
						/>
					</Stack>
				</Box>

				{/* Alert Summary Info */}
				{allAlerts.length > 0 && (
					<Box mt={2}>
						<Typography variant="body2" color="text.secondary" mb={1}>
							{t('Total Alert History')}
						</Typography>
						<Stack direction="row" spacing={1} justifyContent="center">
							<Chip 
								label={`${allAlerts.length} ${t('Total Alerts')}`}
								size="small" 
								variant="outlined" 
								color="info"
							/>
							<Chip 
								label={`${allAlerts.filter(a => a.status === 'resolved').length} ${t('Resolved')}`}
								size="small" 
								variant="outlined" 
								color="success"
							/>
						</Stack>
					</Box>
				)}
			</Box>
		</CardBase>
	);
}