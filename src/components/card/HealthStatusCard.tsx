//---------------------------------------------------------
// Health Status Card for Endpoint Monitoring
//---------------------------------------------------------
import {Box, Typography, LinearProgress, Chip} from '@mui/material';
import {useLiveMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';
import {derive_endpoint_health} from './cardMetricsLogic';
import MetricFigure from './MetricFigure';

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
	const {metrics: liveMetrics, isLoading} = useLiveMetrics(instance, {keyPrefix: 'health-status-realtime', refetchInterval: 10000});

	// Derivation lives in cardMetricsLogic so the "absent ≠ zero" rule is
	// unit-testable without a renderer.
	const healthData = useMemo(() => derive_endpoint_health(liveMetrics), [liveMetrics]);
	const reported = healthData.status !== 'unknown';

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
					<Typography variant="h2" fontWeight="bold" color={reported ? `${currentStatus.color}.main` : 'text.disabled'}>
						{reported ? `${healthData.healthPercentage}%` : t('N/A')}
					</Typography>
					<Chip
						label={currentStatus.label}
						color={currentStatus.color as any}
						size="small"
					/>
				</Box>

				{/* Progress Bar. Unknown health gets an indeterminate-looking empty
				    track, never a full or a zero bar — both of those are claims. */}
				<Box>
					<LinearProgress
						variant="determinate"
						value={healthData.healthPercentage ?? 0}
						color={currentStatus.color as any}
						sx={{
							height: 8,
							borderRadius: 4,
							backgroundColor: 'grey.200',
							...(reported ? {} : {opacity: 0.4})
						}}
					/>
				</Box>

				{/* Detailed Counts */}
				<Box display="flex" justifyContent="space-between">
					<MetricFigure color="success.main" value={healthData.healthy} label={t('Healthy')} />
					<MetricFigure color="error.main" value={healthData.unhealthy} label={t('Unhealthy')} />
					<MetricFigure color="primary.main" value={healthData.total} label={t('Total')} />
				</Box>

				{/* Status Message */}
				{healthData.status === 'no-endpoints' && (
					<Typography variant="body2" color="textSecondary" textAlign="center">
						{t('No endpoints configured')}
					</Typography>
				)}
				{!reported && (
					<Typography variant="body2" color="textSecondary" textAlign="center">
						{t('Metrics collection is not enabled on this instance')}
					</Typography>
				)}
			</Box>
		</CardBase>
	);
}