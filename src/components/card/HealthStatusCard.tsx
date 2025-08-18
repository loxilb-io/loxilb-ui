//---------------------------------------------------------
// Health Status Card for Endpoint Monitoring
//---------------------------------------------------------
import {Box, Typography, LinearProgress, Chip} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {query_get_live_metrics} from 'connector/instance/metrics';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
interface HealthStatusCardProps {
	title: string;
	instance: IInstance | null;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function HealthStatusCard(props: HealthStatusCardProps) {
	const {title, instance} = props;

	// Get live metrics with polling
	const {data: rawLiveMetrics, isLoading} = useQuery({
		queryKey: ['health-status-realtime', instance?.id],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, 2);
		},
		enabled: !!instance,
		refetchInterval: 10000, // 10-second polling
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;

	// Calculate health metrics
	const healthData = useMemo(() => {
		if (!liveMetrics?.critical) {
			return {
				healthy: 0,
				unhealthy: 0,
				total: 0,
				healthPercentage: 0,
				status: 'unknown'
			};
		}

		const healthy = liveMetrics.critical.healthy_endpoints_count || 0;
		const unhealthy = liveMetrics.critical.unhealthy_endpoints_count || 0;
		const total = healthy + unhealthy;
		const healthPercentage = total > 0 ? (healthy / total) * 100 : 0;
		
		let status = 'unknown';
		if (total === 0) {
			status = 'no-endpoints';
		} else if (healthPercentage === 100) {
			status = 'excellent';
		} else if (healthPercentage >= 80) {
			status = 'good';
		} else if (healthPercentage >= 50) {
			status = 'warning';
		} else {
			status = 'critical';
		}

		return {
			healthy,
			unhealthy,
			total,
			healthPercentage: Math.round(healthPercentage),
			status
		};
	}, [liveMetrics]);

	// Status configuration
	const statusConfig = {
		excellent: { color: 'success', label: 'Excellent', bgColor: 'success.light' },
		good: { color: 'info', label: 'Good', bgColor: 'info.light' },
		warning: { color: 'warning', label: 'Warning', bgColor: 'warning.light' },
		critical: { color: 'error', label: 'Critical', bgColor: 'error.light' },
		'no-endpoints': { color: 'grey', label: 'No Endpoints', bgColor: 'grey.300' },
		unknown: { color: 'grey', label: 'Unknown', bgColor: 'grey.300' }
	};

	const currentStatus = statusConfig[healthData.status as keyof typeof statusConfig];

	if (isLoading) {
		return (
			<CardBase title={title}>
				<Box display="flex" justifyContent="center" p={3}>
					<Typography variant="body2" color="textSecondary">Loading...</Typography>
				</Box>
			</CardBase>
		);
	}

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" gap={2}>
				{/* Health Percentage */}
				<Box textAlign="center">
					<Typography variant="h2" fontWeight="bold" color={`${currentStatus.color}.main`}>
						{healthData.healthPercentage}%
					</Typography>
					<Chip 
						label={currentStatus.label}
						color={currentStatus.color as any}
						size="small"
					/>
				</Box>
				
				{/* Progress Bar */}
				<Box>
					<LinearProgress 
						variant="determinate" 
						value={healthData.healthPercentage}
						color={currentStatus.color as any}
						sx={{
							height: 8,
							borderRadius: 4,
							backgroundColor: 'grey.200'
						}}
					/>
				</Box>
				
				{/* Detailed Counts */}
				<Box display="flex" justifyContent="space-between">
					<Box textAlign="center">
						<Typography variant="h4" color="success.main" fontWeight="bold">
							{healthData.healthy}
						</Typography>
						<Typography variant="caption" color="textSecondary">
							{t('Healthy')}
						</Typography>
					</Box>
					<Box textAlign="center">
						<Typography variant="h4" color="error.main" fontWeight="bold">
							{healthData.unhealthy}
						</Typography>
						<Typography variant="caption" color="textSecondary">
							{t('Unhealthy')}
						</Typography>
					</Box>
					<Box textAlign="center">
						<Typography variant="h4" color="primary.main" fontWeight="bold">
							{healthData.total}
						</Typography>
						<Typography variant="caption" color="textSecondary">
							{t('Total')}
						</Typography>
					</Box>
				</Box>
				
				{/* Status Message */}
				{healthData.status === 'no-endpoints' && (
					<Typography variant="body2" color="textSecondary" textAlign="center">
						{t('No endpoints configured')}
					</Typography>
				)}
			</Box>
		</CardBase>
	);
}